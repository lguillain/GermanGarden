"""Topic-walking feed.

A "bucket" is (current_topic, user_level). We stay in the current bucket for
at least `MIN_IN_BUCKET` cards; after that we only leave on a drop streak
(≥ `SWITCH_ON_DROPS` consecutive drops) or when the pool is empty.

Keep anchors you in the bucket (resets the drop streak). Drop ticks the
streak. No activity-weight twiddling, no level mixing — levels are big
jumps and the user picks their level explicitly.

The topic is set by the Guide panel (user pick, LLM steer, or auto-pick
unseen activity).
"""

from __future__ import annotations

import random
import sqlite3
from dataclasses import dataclass

from . import reflect

MIN_IN_BUCKET = 5     # stay at least this many cards in a bucket
SWITCH_ON_DROPS = 7   # after min, this many consecutive drops → switch

LEVELS = ("A1", "A2", "B1")
PROBE_BASE = 0.15     # baseline probe rate per direction (times its affinity)
AFF_MIN, AFF_MAX = 0.0, 1.5

# Affinity update multipliers. See the design doc in the chat / in record_swipe.
AFF_BELOW_LEARNED  = 0.85
AFF_BELOW_KEEP     = 1.10
AFF_BELOW_DROP     = 0.95
AFF_ABOVE_KEEP     = 1.10
AFF_ABOVE_LEARNED  = 1.10
AFF_ABOVE_DROP     = 0.90
AFF_ABOVE_HINT     = 1.05   # Learned at DECLARED level nudges above-affinity up


@dataclass
class Card:
    word_id: str
    lemma: str
    article: str | None
    plural: str | None
    pos: str
    english: str
    level: str
    activity_id: str | None
    activity_name: str | None
    sentence_id: int
    de: str
    en: str


# ---------------------------- state helpers ----------------------------


def ensure_user_state(conn: sqlite3.Connection) -> sqlite3.Row:
    conn.execute("INSERT OR IGNORE INTO user_state (id) VALUES (1)")
    return conn.execute("SELECT * FROM user_state WHERE id = 1").fetchone()


def seed_activity_weights(conn: sqlite3.Connection) -> None:
    """Ensure one row per activity in activity_weights at weight 1.0.
    Kept so `onboarding.steer` can write LLM-derived weights that /guide
    then picks the top of."""
    conn.execute(
        "INSERT OR IGNORE INTO activity_weights (activity_id, weight) "
        "SELECT id, 1.0 FROM activities"
    )


def set_weights(conn: sqlite3.Connection, weights: dict[str, float]) -> None:
    for aid, w in weights.items():
        conn.execute(
            "INSERT INTO activity_weights (activity_id, weight) VALUES (?, ?) "
            "ON CONFLICT(activity_id) DO UPDATE SET "
            "weight = excluded.weight, updated_at = datetime('now')",
            (aid, max(0.01, float(w))),
        )


def set_topic(conn: sqlite3.Connection, topic_id: str | None) -> None:
    """Enter a new (topic, level) bucket. Resets cards_in_bucket and
    drop_streak. Called by the /guide endpoint and by auto-switch."""
    conn.execute(
        "UPDATE user_state SET current_topic = ?, cards_in_bucket = 0, "
        "drop_streak = 0, updated_at = datetime('now') WHERE id = 1",
        (topic_id,),
    )
    conn.commit()


def best_topic_for_level(conn: sqlite3.Connection, level: str,
                         exclude: str | None = None) -> str | None:
    """Pick the next topic to walk, scoped to `level`.

    Only considers topics that have at least one AT-LEVEL word the user hasn't
    swiped and that isn't in `known_words`. Among those, prefers the topic
    with the FEWEST at-level words the user has already swiped — so we
    rotate through fresh topics first. Random tiebreak (fresh users would
    otherwise always land on whatever activity id sorts first).

    Returns None iff no topic has any unseen at-level material (= session end).
    """
    extra = ""
    args: list = [level]
    if exclude:
        extra = " AND wa.activity_id != ?"
        args.append(exclude)
    row = conn.execute(
        f"""
        SELECT wa.activity_id,
               SUM(CASE WHEN w.id IN (SELECT word_id FROM swipes)
                        THEN 1 ELSE 0 END) AS seen,
               SUM(CASE WHEN w.id NOT IN (SELECT word_id FROM swipes)
                         AND w.id NOT IN (SELECT word_id FROM known_words)
                        THEN 1 ELSE 0 END) AS unseen
        FROM word_activities wa
        JOIN words w ON w.id = wa.word_id
        WHERE w.level = ?{extra}
        GROUP BY wa.activity_id
        HAVING unseen > 0
        ORDER BY seen ASC, RANDOM()
        LIMIT 1
        """,
        args,
    ).fetchone()
    return row["activity_id"] if row else None


# ---------------------------- picking ----------------------------


def _choose_level(declared: str, aff_below: float, aff_above: float,
                  rng: random.Random | None = None) -> str:
    """Weighted pick: level-1 (comfort probe), declared, or level+1 (stretch probe)."""
    if declared not in LEVELS:
        return declared
    rng = rng or random
    i = LEVELS.index(declared)
    p_below = PROBE_BASE * aff_below if i > 0           else 0.0
    p_above = PROBE_BASE * aff_above if i < len(LEVELS) - 1 else 0.0
    r = rng.random()
    if r < p_below:               return LEVELS[i - 1]
    if r < p_below + p_above:     return LEVELS[i + 1]
    return declared


def _pick_word_with_mix(conn, topic: str, declared: str,
                        aff_below: float, aff_above: float) -> "Card | None":
    """Pick a level per probe-mix, then a word at that level. If the chosen
    level is empty for this topic, fall back to declared."""
    chosen = _choose_level(declared, aff_below, aff_above)
    card = _pick_word(conn, topic, chosen)
    if card is None and chosen != declared:
        card = _pick_word(conn, topic, declared)
    return card


def _pick_word(conn: sqlite3.Connection, topic: str, level: str) -> Card | None:
    row = conn.execute(
        """
        SELECT w.*, s.id AS sentence_id, s.text AS de, s.english AS en,
               a.name AS activity_name
        FROM word_activities wa
        JOIN words w      ON w.id = wa.word_id
        JOIN sentences s  ON s.word_id = w.id AND s.activity_id = wa.activity_id
        JOIN activities a ON a.id = wa.activity_id
        WHERE wa.activity_id = ? AND w.level = ?
          AND w.id NOT IN (SELECT word_id FROM swipes)
          AND w.id NOT IN (SELECT word_id FROM known_words)
        ORDER BY RANDOM()
        LIMIT 1
        """,
        (topic, level),
    ).fetchone()
    if not row:
        return None
    return Card(
        word_id=row["id"], lemma=row["lemma"], article=row["article"],
        plural=row["plural"], pos=row["pos"], english=row["english"],
        level=row["level"], activity_id=topic,
        activity_name=row["activity_name"],
        sentence_id=row["sentence_id"], de=row["de"], en=row["en"],
    )


def _choose_topic(conn: sqlite3.Connection, level: str,
                  exclude: str | None = None) -> str | None:
    """LLM recommendation from kept words; deterministic rotation fallback."""
    return (reflect.recommend_next_topic(conn, level, exclude)
            or best_topic_for_level(conn, level, exclude))


def next_card(conn: sqlite3.Connection) -> Card | None:
    state = ensure_user_state(conn)
    level = state["level"] or "A2"
    aff_below = float(state["affinity_below"] or 1.0)
    aff_above = float(state["affinity_above"] or 1.0)
    topic = state["current_topic"]
    cards_in = int(state["cards_in_bucket"])
    streak = int(state["drop_streak"])

    # 1. Enter a bucket if we don't have one.
    if not topic:
        topic = _choose_topic(conn, level)
        if not topic:
            return None
        set_topic(conn, topic)
        cards_in, streak = 0, 0

    # 2. Auto-switch if past minimum AND dropping streak.
    if cards_in >= MIN_IN_BUCKET and streak >= SWITCH_ON_DROPS:
        new_topic = _choose_topic(conn, level, exclude=topic)
        if new_topic:
            topic = new_topic
            set_topic(conn, topic)

    # 3. Pick a word, biased by affinity probes.
    card = _pick_word_with_mix(conn, topic, level, aff_below, aff_above)

    # 4. Current bucket's declared level is exhausted → next-best topic.
    if card is None:
        new_topic = _choose_topic(conn, level, exclude=topic)
        if not new_topic:
            return None
        set_topic(conn, new_topic)
        card = _pick_word_with_mix(conn, new_topic, level, aff_below, aff_above)
    return card


# ---------------------------- recording ----------------------------


LEVEL_BIAS_STEP = 0.1    # per "learned" click
LEVEL_BIAS_MAX  = 2.0


def _affinity_update(
    card_level: str | None,
    declared: str | None,
    action: str,
    drop_reason: str | None,
) -> tuple[float, float]:
    """Return (delta_below, delta_above) multipliers for the swipe. 1.0 = no change.

    Rules:
      - BELOW declared card: Learned ×0.85 (user knows it, decay),
                             Keep ×1.10 (user wants more),
                             Drop ×0.95 (not useful)
      - ABOVE declared card: Keep ×1.10, Learned ×1.10, Drop ×0.90
      - DECLARED card:       Learned ×1.05 on the ABOVE affinity (ready-up hint),
                             Keep / Drop → no mix change (drop_streak handles)
    """
    if card_level not in LEVELS or declared not in LEVELS:
        return 1.0, 1.0
    rel = LEVELS.index(card_level) - LEVELS.index(declared)   # -1, 0, +1
    db, da = 1.0, 1.0
    if rel == -1:
        if action == "drop" and drop_reason == "known":          db = AFF_BELOW_LEARNED
        elif action == "keep":                                   db = AFF_BELOW_KEEP
        elif action == "drop" and drop_reason == "uninteresting":db = AFF_BELOW_DROP
    elif rel == +1:
        if action == "keep":                                     da = AFF_ABOVE_KEEP
        elif action == "drop" and drop_reason == "known":        da = AFF_ABOVE_LEARNED
        elif action == "drop" and drop_reason == "uninteresting":da = AFF_ABOVE_DROP
    else:  # rel == 0 (card at declared level)
        if action == "drop" and drop_reason == "known":          da = AFF_ABOVE_HINT
    return db, da


def record_swipe(
    conn: sqlite3.Connection,
    word_id: str,
    activity_id: str | None,
    sentence_id: int,
    action: str,
    drop_reason: str | None = None,
) -> None:
    """action ∈ {'keep', 'drop'}; drop_reason ∈ {None, 'known', 'uninteresting'}.

    - keep:                   anchors you in the bucket, no bucket signal change
                              beyond resetting the drop streak.
    - drop + 'known':         user already knows it. Filter from feed via
                              `known_words`, bump `level_bias` up. Does NOT
                              count against the topic (streak unchanged).
    - drop + 'uninteresting': user doesn't care. Ticks drop_streak so we leave
                              the topic after min-5.
    """
    assert action in ("keep", "drop")
    if action == "drop":
        assert drop_reason in ("known", "uninteresting")

    conn.execute(
        "INSERT INTO swipes (word_id, activity_id, sentence_id, action, drop_reason) "
        "VALUES (?, ?, ?, ?, ?)",
        (word_id, activity_id, sentence_id, action, drop_reason),
    )

    # Affinity update, scoped by the card's level relative to declared.
    row = conn.execute(
        "SELECT w.level AS card_level, u.level AS declared "
        "FROM words w, user_state u WHERE w.id = ? AND u.id = 1",
        (word_id,),
    ).fetchone()
    delta_below, delta_above = _affinity_update(
        row["card_level"] if row else None,
        row["declared"]   if row else None,
        action, drop_reason,
    )
    conn.execute(
        "UPDATE user_state SET "
        "  affinity_below = MAX(?, MIN(?, affinity_below * ?)), "
        "  affinity_above = MAX(?, MIN(?, affinity_above * ?)) "
        "WHERE id = 1",
        (AFF_MIN, AFF_MAX, delta_below, AFF_MIN, AFF_MAX, delta_above),
    )

    if drop_reason == "known":
        conn.execute(
            "INSERT OR IGNORE INTO known_words (word_id) VALUES (?)",
            (word_id,),
        )
    conn.execute(
        """
        UPDATE user_state SET
          swipe_count     = swipe_count + 1,
          cards_in_bucket = cards_in_bucket + 1,
          drop_streak     = CASE WHEN ? = 'keep'          THEN 0
                                 WHEN ? = 'uninteresting' THEN drop_streak + 1
                                 ELSE drop_streak END,
          level_bias      = CASE WHEN ? = 'known'
                                 THEN MIN(?, level_bias + ?)
                                 ELSE level_bias END,
          updated_at      = datetime('now')
        WHERE id = 1
        """,
        (action, drop_reason, drop_reason, LEVEL_BIAS_MAX, LEVEL_BIAS_STEP),
    )
    conn.commit()
