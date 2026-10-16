"""Practice selection, retained from GermanMatch."""
from __future__ import annotations
import sqlite3

def _practice_scope_words(conn: sqlite3.Connection, scope: str,
                          topic: str | None) -> list[sqlite3.Row]:
    """Resolve a practice scope to a list of word rows.
    scope ∈ {'bag', 'topic', 'all'}; topic required when scope == 'topic'."""
    if scope == "bag":
        base = conn.execute(
            """
            SELECT w.id, w.lemma, w.article, w.plural, w.pos, w.english, w.level
            FROM swipes s JOIN words w ON w.id = s.word_id
            WHERE s.action = 'keep' AND s.planted_at IS NULL
            GROUP BY w.id
            """
        ).fetchall()
        return _attach_sentence(conn, base, activity_id=None)
    if scope == "topic" and topic:
        base = conn.execute(
            """
            SELECT w.id, w.lemma, w.article, w.plural, w.pos, w.english, w.level
            FROM word_activities wa JOIN words w ON w.id = wa.word_id
            JOIN swipes sp ON sp.word_id = w.id
                           AND sp.action = 'keep' AND sp.planted_at IS NOT NULL
            WHERE wa.activity_id = :aid
            GROUP BY w.id
            """,
            {"aid": topic},
        ).fetchall()
        return _attach_sentence(conn, base, activity_id=topic)
    base = conn.execute(
        """
        SELECT w.id, w.lemma, w.article, w.plural, w.pos, w.english, w.level
        FROM swipes s JOIN words w ON w.id = s.word_id
        WHERE s.action = 'keep' AND s.planted_at IS NOT NULL
        GROUP BY w.id
        """
    ).fetchall()
    return _attach_sentence(conn, base, activity_id=None)

def _attach_sentence(conn: sqlite3.Connection, rows: list[sqlite3.Row],
                     activity_id: str | None) -> list[dict]:
    """Pick ONE sentence row per word so DE/EN stay paired. Prefers a
    sentence tagged for `activity_id` when given, falls back to any."""
    out: list[dict] = []
    for r in rows:
        sent = None
        if activity_id:
            sent = conn.execute(
                "SELECT text AS de, english AS en FROM sentences "
                "WHERE word_id = ? AND activity_id = ? ORDER BY RANDOM() LIMIT 1",
                (r["id"], activity_id),
            ).fetchone()
        if sent is None:
            sent = conn.execute(
                "SELECT text AS de, english AS en FROM sentences "
                "WHERE word_id = ? ORDER BY RANDOM() LIMIT 1",
                (r["id"],),
            ).fetchone()
        d = dict(r)
        d["de"] = sent["de"] if sent else ""
        d["en"] = sent["en"] if sent else ""
        out.append(d)
    return out

def _flashcard_rows(conn: sqlite3.Connection, scope: str, topic: str | None,
                    limit: int) -> list[sqlite3.Row]:
    rows = _practice_scope_words(conn, scope, topic)
    # Browsing includes learned words and never changes progress.
    import random as _r
    _r.shuffle(rows)
    return rows[:limit]
