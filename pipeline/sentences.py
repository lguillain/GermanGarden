"""LLM-generate missing sentences, as the last resort after Goethe + Tatoeba.

Two kinds of gap, one job list:
- every (word, activity) tag with no sentence for that activity yet,
- every core word (no activity tags) with no sentence at all.

Snapshot: data/derived/generated_sentences.json, keyed by (word_id, activity_id).

    python -m pipeline.sentences [--limit N]
"""

from __future__ import annotations

import sqlite3

from . import snapshots
from .llm import MODEL_WRITE, Prompt
from .steps import cli, indexed, label, numbered, run_batches

BATCH = 20

SYSTEM = (
    "You write short, natural German example sentences for language learners. "
    "Rules:\n"
    "- One sentence per row.\n"
    "- The sentence must be in the row's everyday context.\n"
    "- Match the target CEFR level: A1 very simple, A2 clear, B1 natural but "
    "not idiomatic-heavy.\n"
    "- Use the exact lemma (noun with its article; verb conjugated).\n"
    "- Then give a plain, idiomatic English translation.\n\n"
    'Reply with STRICT JSON: {"<row number>": {"de": "...", "en": "..."}, ...}, '
    "one entry per row. No prose, no markdown."
)

CORE_CONTEXT = "a short, generic everyday sentence"

# A gap is open while no sentence (from any source) covers it.
_ACTIVITY_GAP = "NOT EXISTS (SELECT 1 FROM sentences s WHERE s.word_id = ? AND s.activity_id = ?)"
_CORE_GAP = "NOT EXISTS (SELECT 1 FROM sentences s WHERE s.word_id = ?)"


def _pending(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT w.id AS word_id, w.lemma, w.article, w.pos, w.level,
               a.id AS activity_id, a.name || ' — ' || a.description AS context
        FROM word_activities wa
        JOIN words w      ON w.id = wa.word_id
        JOIN activities a ON a.id = wa.activity_id
        WHERE NOT EXISTS (SELECT 1 FROM sentences s
                          WHERE s.word_id = w.id AND s.activity_id = a.id)
        UNION ALL
        SELECT w.id, w.lemma, w.article, w.pos, w.level, NULL, ?
        FROM words w
        WHERE NOT EXISTS (SELECT 1 FROM word_activities wa WHERE wa.word_id = w.id)
          AND NOT EXISTS (SELECT 1 FROM sentences s WHERE s.word_id = w.id)
        ORDER BY 5, 1
        """,
        (CORE_CONTEXT,),
    ).fetchall()


def _insert(conn: sqlite3.Connection, word_id: str, activity_id: str | None,
            de: str, en: str) -> int:
    """Insert unless the gap was closed in the meantime. Returns 1 if inserted."""
    gap, args = (_CORE_GAP, (word_id,)) if activity_id is None else (_ACTIVITY_GAP, (word_id, activity_id))
    return conn.execute(
        f"INSERT INTO sentences (word_id, activity_id, text, english, source) "
        f"SELECT ?, ?, ?, ?, 'llm' WHERE {gap}",
        (word_id, activity_id, de, en, *args),
    ).rowcount


def run(conn: sqlite3.Connection, limit: int | None = None) -> int:
    cache = snapshots.load_generated_sentences()
    restored = sum(_insert(conn, w, a, r["de"], r.get("en", "")) for (w, a), r in cache.items())
    conn.commit()
    if restored:
        print(f"  restored {restored} generated sentences from snapshot")

    pending = _pending(conn)[:limit]
    print(f"  {len(pending)} gaps "
          f"({sum(p['activity_id'] is None for p in pending)} core)")

    def prompt(batch):
        return Prompt(
            system=SYSTEM,
            user="Generate one sentence per row:\n\n" + numbered(
                batch, lambda p: f"{label(p)} ({p['pos']}, {p['level']}) — context: {p['context']}"),
            model=MODEL_WRITE, max_tokens=3000, temperature=0.6,
        )

    def apply(batch, data):
        n = 0
        for p, item in indexed(data, batch):
            if not isinstance(item, dict) or not item.get("de") or not item.get("en"):
                continue
            w, a = p["word_id"], p["activity_id"]
            cache[(w, a)] = {"word_id": w, "activity_id": a, "de": item["de"], "en": item["en"]}
            n += _insert(conn, w, a, item["de"], item["en"])
        return n

    return run_batches(conn, "generate", pending, BATCH, prompt, apply,
                       lambda: snapshots.save_generated_sentences(cache))


if __name__ == "__main__":
    cli(run, "sentences generated via LLM")
