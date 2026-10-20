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
          AND s.word_id NOT IN (SELECT word_id FROM known_words UNION SELECT word_id FROM flashcard_learned)
            GROUP BY w.id
            """
        ).fetchall()
        return _attach_sentence(conn, base, activity_id=None)
    base = conn.execute("""
        SELECT w.* FROM words w WHERE
          (EXISTS(SELECT 1 FROM swipes s WHERE s.word_id=w.id AND s.action='keep' AND s.planted_at IS NOT NULL)
           OR EXISTS(SELECT 1 FROM known_words k WHERE k.word_id=w.id)
           OR EXISTS(SELECT 1 FROM flashcard_learned f WHERE f.word_id=w.id))
          AND (? <> 'topic' OR EXISTS(SELECT 1 FROM word_activities wa WHERE wa.word_id=w.id AND wa.activity_id=?))
        ORDER BY w.id
    """, (scope, topic)).fetchall()
    return _attach_sentence(conn, base, activity_id=topic if scope == 'topic' else None)

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
