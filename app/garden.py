"""Vocab Garden state: seed bag, planting, growth stages, SM-2 reviews,
and time tracking.

The garden is a view over `swipes` (keep rows) plus `word_srs` (per-word
spaced-repetition state). A kept word is in the SEED BAG while its swipe
row's `planted_at` is NULL; planting flips it to the current time, which
moves the word into its topics' plant beds in the garden.

Reviews are the only thing that advances growth. Grades 1–4 feed an Anki
SM-2 variant; interval and ease update deterministically.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

SEED_BAG_CAP = 20
TIMER_SECONDS = 5 * 60                    # 5-minute visible timer
SESSION_GAP_SECONDS = 90                  # heartbeat gap that starts a new session

# Growth-stage thresholds (0 = unplanted; 5 = fully grown).
GROWTH_LABELS = ["seed", "sprout", "seedling", "sapling", "bloom", "full"]
GROWTH_ICONS  = [".", ",", "*", "Y", "W", "#"]  # ascii fallbacks; CSS adds icons

MAX_GROWTH = 5


# ---------------------------- seed bag ----------------------------


def seed_bag(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Current unplanted keeps, newest first, capped at SEED_BAG_CAP."""
    return conn.execute(
        """
        SELECT w.id, w.lemma, w.article, w.pos, w.english, w.level,
               MAX(s.swiped_at) AS kept_at
        FROM swipes s JOIN words w ON w.id = s.word_id
        WHERE s.action = 'keep' AND s.planted_at IS NULL
        GROUP BY w.id
        ORDER BY kept_at DESC
        LIMIT ?
        """,
        (SEED_BAG_CAP,),
    ).fetchall()


def seed_bag_count(conn: sqlite3.Connection) -> int:
    return int(conn.execute(
        """
        SELECT COUNT(DISTINCT word_id) FROM swipes
        WHERE action = 'keep' AND planted_at IS NULL
        """
    ).fetchone()[0])


# ---------------------------- garden view ----------------------------


@dataclass
class TopicCard:
    id: str
    name: str
    description: str
    total: int           # total words in the topic (at user's level filter)
    planted: int         # distinct words planted
    grown_sum: float     # sum of growth / MAX_GROWTH across planted (0..planted)
    seed_bag_here: int   # words from the seed bag that belong here
    unseen: int          # not yet in bag, planted, archived, or learned

    @property
    def planted_pct(self) -> int:
        return 0 if not self.total else int(100 * self.planted / self.total)

    @property
    def grown_pct(self) -> int:
        """Progress bar fill: fraction of the topic that is 'fully grown
        equivalent'. Each planted word contributes growth/MAX; learned
        words count as fully grown via GROWTH-raise in grown_sum."""
        if not self.total:
            return 0
        return int(100 * self.grown_sum / self.total)


def garden_topics(conn: sqlite3.Connection, level: str | None) -> list[TopicCard]:
    """Return every activity as a TopicCard, scoped to `level` if given.
    Topics with planted words come first; the rest follow alphabetically."""
    level_clause = "AND w.level = :level" if level else ""
    rows = conn.execute(
        f"""
        SELECT a.id, a.name, a.description,
               COUNT(DISTINCT w.id) AS total,
               COUNT(DISTINCT CASE
                   WHEN sp.planted_at IS NOT NULL THEN w.id END) AS planted,
               COUNT(DISTINCT CASE
                   WHEN sp.planted_at IS NULL AND sp.action = 'keep' THEN w.id END)
                   AS seed_bag_here,
               COUNT(DISTINCT CASE
                   WHEN sp.id IS NULL AND w.id NOT IN (SELECT word_id FROM known_words)
                   THEN w.id END) AS unseen,
               COALESCE(SUM(CASE
                   WHEN sp.planted_at IS NOT NULL THEN
                     CASE
                       WHEN fl.word_id IS NOT NULL THEN 1.0
                       WHEN srs.state = 'graduated' THEN 1.0
                       WHEN srs.interval_days >= 45 THEN 1.0
                       WHEN srs.interval_days >= 21 THEN 0.8
                       WHEN srs.interval_days >= 7  THEN 0.6
                       WHEN srs.reps >= 2 THEN 0.4
                       WHEN srs.reps = 1 THEN 0.2
                       ELSE 0.0
                     END
                   ELSE 0.0 END), 0) AS grown_sum
        FROM activities a
        JOIN word_activities wa ON wa.activity_id = a.id
        JOIN words w ON w.id = wa.word_id
        LEFT JOIN swipes sp ON sp.word_id = w.id AND sp.action = 'keep'
        LEFT JOIN word_srs srs ON srs.word_id = w.id
        LEFT JOIN flashcard_learned fl ON fl.word_id = w.id
        WHERE 1=1 {level_clause}
        GROUP BY a.id
        ORDER BY planted DESC, a.name
        """,
        {"level": level} if level else {},
    ).fetchall()
    return [
        TopicCard(
            id=r["id"], name=r["name"],
            description=r["description"] or "",
            total=int(r["total"]), planted=int(r["planted"]),
            grown_sum=float(r["grown_sum"]),
            seed_bag_here=int(r["seed_bag_here"]),
            unseen=int(r["unseen"]),
        )
        for r in rows
    ]


def topic_words(conn: sqlite3.Connection, activity_id: str) -> list[sqlite3.Row]:
    """Plants include planted words and words already marked learned."""
    return conn.execute(
        """
        SELECT w.id, w.lemma, w.article, w.pos, w.english, w.level,
               COALESCE(srs.reps, 0) AS reps,
               COALESCE(srs.interval_days, 0) AS interval_days,
               COALESCE(srs.state, 'learning') AS state,
               srs.due_at,
               (COALESCE(srs.due_at <= datetime('now'), 0)
                AND fl.word_id IS NULL AND k.word_id IS NULL) AS review_due,
               CASE WHEN fl.word_id IS NOT NULL OR k.word_id IS NOT NULL
                    THEN 1 ELSE 0 END AS learned
        FROM word_activities wa
        JOIN words w ON w.id = wa.word_id
        LEFT JOIN word_srs srs ON srs.word_id = w.id
        LEFT JOIN flashcard_learned fl ON fl.word_id = w.id
        LEFT JOIN known_words k ON k.word_id = w.id
        WHERE wa.activity_id = ?
          AND (fl.word_id IS NOT NULL OR k.word_id IS NOT NULL OR EXISTS (
              SELECT 1 FROM swipes sp WHERE sp.word_id=w.id
              AND sp.action='keep' AND sp.planted_at IS NOT NULL))
        ORDER BY learned DESC, srs.interval_days DESC, w.lemma COLLATE NOCASE
        """,
        (activity_id,),
    ).fetchall()


def growth_stage(row: sqlite3.Row | dict) -> int:
    """Classify a planted word into 0..MAX_GROWTH."""
    if isinstance(row, sqlite3.Row):
        r = dict(row)
    else:
        r = row
    if r.get("learned"):
        return MAX_GROWTH
    state = r.get("state") or "learning"
    if state == "graduated":
        return MAX_GROWTH
    iv = float(r.get("interval_days") or 0)
    reps = int(r.get("reps") or 0)
    if iv >= 45: return 5
    if iv >= 21: return 4
    if iv >= 7:  return 3
    if reps >= 2: return 2
    if reps >= 1: return 1
    return 0


# ---------------------------- SM-2 scheduling ----------------------------


LEARNING_STEPS_MIN = (1, 10)      # "again" / "hard" in learning
GRADUATING_INTERVAL = 1.0         # days when a learning card graduates
EASY_BONUS = 1.3                  # multiplier applied to easy promotions
HARD_FACTOR = 1.2
MIN_EASE = 1.3


def _ensure_srs(conn: sqlite3.Connection, word_id: str) -> sqlite3.Row:
    conn.execute(
        "INSERT OR IGNORE INTO word_srs (word_id) VALUES (?)",
        (word_id,),
    )
    return conn.execute(
        "SELECT * FROM word_srs WHERE word_id = ?", (word_id,)
    ).fetchone()


def review_outcome(srs: dict, grade: int) -> dict:
    """Pure scheduling calculation shared by previews and saved ratings."""
    assert 1 <= grade <= 4
    ease = float(srs["ease"] or 2.5)
    interval = float(srs["interval_days"] or 0.0)
    reps = int(srs["reps"] or 0)
    lapses = int(srs["lapses"] or 0)
    state = srs["state"] or "learning"

    if grade == 1:                              # again: lapse
        state = "relearning" if state == "review" else "learning"
        reps = 0
        lapses += 1
        ease = max(MIN_EASE, ease - 0.2)
        interval = LEARNING_STEPS_MIN[0] / 1440  # 1 minute, in days
    elif state in ("learning", "relearning"):
        if grade == 2:                          # hard in learning: wait longer
            interval = LEARNING_STEPS_MIN[1] / 1440
        elif grade == 3:                        # good → graduate at 1 day
            interval = GRADUATING_INTERVAL
            state = "review"
            reps += 1
        else:                                   # easy → 4-day graduation
            interval = GRADUATING_INTERVAL * 4
            state = "review"
            reps += 1
    else:                                       # already in review
        reps += 1
        if grade == 2:
            ease = max(MIN_EASE, ease - 0.15)
            interval = max(1.0, interval * HARD_FACTOR)
        elif grade == 3:
            interval = max(1.0, interval * ease)
        else:                                   # easy
            ease = ease + 0.15
            interval = max(1.0, interval * ease * EASY_BONUS)

    if state == "review" and interval >= 60:
        state = "graduated"

    return {'ease': ease, 'interval_days': interval, 'reps': reps,
            'lapses': lapses, 'state': state}


def grade_word(conn: sqlite3.Connection, word_id: str, grade: int) -> dict:
    srs = _ensure_srs(conn, word_id)
    outcome = review_outcome(dict(srs), grade)
    ease = outcome['ease']
    interval = outcome['interval_days']
    reps = outcome['reps']
    lapses = outcome['lapses']
    state = outcome['state']

    conn.execute(
        """
        UPDATE word_srs
        SET ease = ?, interval_days = ?, reps = ?, lapses = ?, state = ?,
            last_grade = ?, last_review_at = datetime('now'),
            due_at = datetime('now', ? || ' seconds')
        WHERE word_id = ?
        """,
        (ease, interval, reps, lapses, state, grade,
         int(interval * 86400), word_id),
    )
    conn.execute(
        "INSERT INTO reviews (word_id, grade) VALUES (?, ?)",
        (word_id, grade),
    )
    # Reviewing a seed is the planting action; save it with its first rating.
    conn.execute("""UPDATE swipes SET planted_at=datetime('now')
                    WHERE word_id=? AND action='keep' AND planted_at IS NULL""",
                 (word_id,))
    conn.commit()
    return {
        "ease": ease, "interval_days": interval, "reps": reps,
        "state": state, "due_at_offset_days": interval,
    }


def _review_scope_sql(scope: str, activity_id: str | None) -> tuple[str, dict]:
    """Return (WHERE clause, params) for picking reviewable words."""
    if scope == "bag":
        return (
            "sp.action = 'keep' AND sp.planted_at IS NULL",
            {},
        )
    if scope == "topic" and activity_id:
        return (
            "sp.action = 'keep' AND sp.planted_at IS NOT NULL "
            "AND EXISTS (SELECT 1 FROM word_activities wa "
            "WHERE wa.word_id = w.id AND wa.activity_id = :aid) "
            "AND fl.word_id IS NULL",
            {"aid": activity_id},
        )
    # all-planted
    return (
        "sp.action = 'keep' AND sp.planted_at IS NOT NULL AND fl.word_id IS NULL",
        {},
    )


def review_remaining(conn: sqlite3.Connection, scope: str, activity_id: str | None = None) -> int:
    """Count distinct new or currently due words in this review set."""
    where, params = _review_scope_sql(scope, activity_id)
    return conn.execute(f"""
        SELECT COUNT(DISTINCT w.id)
        FROM words w JOIN swipes sp ON sp.word_id=w.id
        LEFT JOIN word_srs srs ON srs.word_id=w.id
        LEFT JOIN flashcard_learned fl ON fl.word_id=w.id
        WHERE {where}
          AND (srs.word_id IS NULL OR srs.due_at <= datetime('now'))
    """, params).fetchone()[0]


def next_review_card(conn: sqlite3.Connection, scope: str,
                     activity_id: str | None = None) -> dict | None:
    """Pick the next word to review in `scope` ∈ {'bag', 'topic', 'all'}.

    Pick new words first, then due words (oldest due first).
    Return None when no new or currently due words remain.
    """
    where, params = _review_scope_sql(scope, activity_id)
    row = conn.execute(
        f"""
        SELECT w.id AS word_id, w.lemma, w.article, w.pos, w.english, w.level,
               COALESCE(srs.state, 'learning') AS state,
               COALESCE(srs.reps, 0) AS reps,
               COALESCE(srs.interval_days, 0) AS interval_days,
               srs.due_at
        FROM words w
        JOIN swipes sp ON sp.word_id = w.id
        LEFT JOIN word_srs srs ON srs.word_id = w.id
        LEFT JOIN flashcard_learned fl ON fl.word_id = w.id
        WHERE {where}
          AND (srs.word_id IS NULL OR srs.due_at <= datetime('now'))
        GROUP BY w.id
        ORDER BY
          CASE WHEN srs.word_id IS NULL THEN 0
               WHEN srs.due_at <= datetime('now') THEN 1
               ELSE 2 END,
          srs.due_at ASC
        LIMIT 1
        """,
        params,
    ).fetchone()
    if not row:
        return None
    card = dict(row)
    saved = conn.execute('SELECT * FROM word_srs WHERE word_id=?', (card['word_id'],)).fetchone()
    state = dict(saved) if saved else dict(ease=2.5, interval_days=0, reps=0, lapses=0, state='learning')
    learned = bool(conn.execute('SELECT 1 FROM flashcard_learned WHERE word_id=?', (card['word_id'],)).fetchone())
    card['growth'] = growth_stage({**state, 'learned': learned})
    card['rating_options'] = []
    for grade in range(1, 5):
        outcome = review_outcome(state, grade)
        card['rating_options'].append({
            'grade': grade,
            'next_review_seconds': int(outcome['interval_days'] * 86400),
            'growth': growth_stage({**outcome, 'learned': learned}),
        })
    # Pick ONE sentence row so the DE/EN pair stays matched.
    sent = conn.execute(
        "SELECT text AS de, english AS en FROM sentences "
        "WHERE word_id = ? ORDER BY RANDOM() LIMIT 1",
        (card["word_id"],),
    ).fetchone()
    card["de"] = sent["de"] if sent else ""
    card["en"] = sent["en"] if sent else ""
    return card


# ---------------------------- time tracking ----------------------------


def heartbeat(conn: sqlite3.Connection) -> dict:
    """Called periodically from the browser. Extends the current session
    (if last beat was recent) or starts a new one. Returns dashboard-ready
    time stats."""
    row = conn.execute(
        "SELECT id, started_at, last_beat_at, seconds FROM sessions "
        "ORDER BY last_beat_at DESC LIMIT 1"
    ).fetchone()
    gap = SESSION_GAP_SECONDS
    if row:
        delta = conn.execute(
            "SELECT CAST((julianday('now') - julianday(?)) * 86400 AS INTEGER)",
            (row["last_beat_at"],),
        ).fetchone()[0]
        delta = int(delta or 0)
        if delta <= gap:
            conn.execute(
                "UPDATE sessions SET seconds = seconds + ?, "
                "last_beat_at = datetime('now') WHERE id = ?",
                (max(0, delta), row["id"]),
            )
        else:
            conn.execute("INSERT INTO sessions DEFAULT VALUES")
    else:
        conn.execute("INSERT INTO sessions DEFAULT VALUES")
    conn.commit()
    return time_stats(conn)


def time_stats(conn: sqlite3.Connection) -> dict:
    """Return {today_seconds, total_seconds, current_session_seconds}."""
    today = conn.execute(
        "SELECT COALESCE(SUM(seconds), 0) FROM sessions "
        "WHERE date(started_at) = date('now','localtime') "
        "   OR date(last_beat_at) = date('now','localtime')"
    ).fetchone()[0]
    total = conn.execute(
        "SELECT COALESCE(SUM(seconds), 0) FROM sessions"
    ).fetchone()[0]
    current = conn.execute(
        "SELECT COALESCE(seconds, 0) FROM sessions ORDER BY last_beat_at DESC LIMIT 1"
    ).fetchone()
    return {
        "today_seconds": int(today or 0),
        "total_seconds": int(total or 0),
        "current_session_seconds": int(current[0]) if current else 0,
        "timer_seconds": TIMER_SECONDS,
    }


# ---------------------------- summary for the home ----------------------------


def home_summary(conn: sqlite3.Connection, level: str | None) -> dict:
    """Everything the garden template needs in one shot."""
    bag_count = seed_bag_count(conn)
    due_now = review_remaining(conn, 'all')
    new_in_bag = bag_count   # bag words are always reviewable
    planted_total = conn.execute(
        "SELECT COUNT(DISTINCT word_id) FROM swipes "
        "WHERE action = 'keep' AND planted_at IS NOT NULL"
    ).fetchone()[0]
    return {
        "bag_count": bag_count,
        "bag_cap": SEED_BAG_CAP,
        "due_now": int(due_now or 0),
        "new_in_bag": int(new_in_bag or 0),
        "planted_total": int(planted_total or 0),
        "time": time_stats(conn),
    }


def topic_overview(conn: sqlite3.Connection, level: str | None = None) -> dict:
    """Disjoint counts at the selected level; one word contributes once per topic."""
    rows = conn.execute("""
        WITH classified AS (
          SELECT wa.activity_id,
            CASE
              WHEN EXISTS(SELECT 1 FROM flashcard_learned f WHERE f.word_id=wa.word_id)
                OR EXISTS(SELECT 1 FROM known_words k WHERE k.word_id=wa.word_id)
                THEN 'grown'
              WHEN EXISTS(SELECT 1 FROM swipes s WHERE s.word_id=wa.word_id
                          AND s.action='keep' AND s.planted_at IS NOT NULL)
                AND EXISTS(SELECT 1 FROM word_srs r WHERE r.word_id=wa.word_id
                           AND r.due_at <= datetime('now')) THEN 'due'
              WHEN EXISTS(SELECT 1 FROM word_srs r WHERE r.word_id=wa.word_id
                          AND (r.state='graduated' OR r.interval_days>=45)) THEN 'grown'
              WHEN EXISTS(SELECT 1 FROM swipes s WHERE s.word_id=wa.word_id
                          AND s.action='keep' AND s.planted_at IS NOT NULL) THEN 'planted'
              WHEN EXISTS(SELECT 1 FROM swipes s WHERE s.word_id=wa.word_id
                          AND s.action='keep' AND s.planted_at IS NULL) THEN 'seeds'
              ELSE 'unseen'
            END AS category
          FROM word_activities wa JOIN words w ON w.id=wa.word_id
          WHERE (:level IS NULL OR w.level=:level)
        )
        SELECT activity_id, category, COUNT(*) AS count
        FROM classified GROUP BY activity_id, category
    """, {"level": level}).fetchall()
    result = {}
    for row in rows:
        counts = result.setdefault(row['activity_id'], dict(unseen=0, seeds=0, planted=0, due=0, grown=0))
        counts[row['category']] = row['count']
    return result
