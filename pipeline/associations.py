"""Choose, for each word, up to six words a learner would naturally associate with it.

The whole vocabulary is the cached system prompt, so the LLM can only pick
existing words. Words of the same family (shared stem or compound) are left
out because the app finds those itself. An empty list is kept in the snapshot
(data/derived/word_associations.json) so the word is never re-sent.

    python -m pipeline.associations [--limit N]
"""

from __future__ import annotations

import sqlite3

from . import snapshots
from .llm import MODEL_BULK, Prompt
from .steps import cli, indexed, numbered, restore, run_batches

BATCH = 40
LIMIT = 6


def _system(conn: sqlite3.Connection) -> str:
    vocabulary = "\n".join(
        f"{w['id']}: {w['lemma']} ({w['english']})"
        for w in conn.execute("SELECT id, lemma, english FROM words ORDER BY id")
    )
    return (
        "You help German learners see which words belong together. For each word "
        f"you are given, choose up to {LIMIT} words from the vocabulary below that a "
        "learner would clearly and immediately associate with it: words used in the "
        "same everyday situation, typical pairings, or natural opposites.\n\n"
        "Good: Arzt → Praxis, Termin, krank, Rezept. Zug → Gleis, Bahnhof, Fahrkarte, "
        "Verspätung. kalt → warm, Winter, frieren.\n"
        "Bad: Großmutter → krank (possible, but not a clear connection).\n\n"
        "Rules:\n"
        "- Only use ids from the vocabulary. Order from strongest to weakest.\n"
        "- Leave out words of the same family (shared stem or compound, e.g. fahren → "
        "Fahrer, Abfahrt); they are shown elsewhere.\n"
        "- Fewer strong words are better than six loose ones. Grammar words and very "
        "generic words (machen, Sache, weil) usually get an empty list.\n\n"
        f"Vocabulary (id: word (meaning)):\n{vocabulary}\n\n"
        'Reply with STRICT JSON: {"<row number>": ["<id>", ...], ...}. No prose, no markdown.'
    )


def _clean(word_id: str, ids, known: set[str]) -> list[str]:
    """Keep known, distinct ids other than the word itself, at most LIMIT."""
    out: list[str] = []
    for related in ids if isinstance(ids, list) else []:
        if isinstance(related, str) and related in known and related != word_id and related not in out:
            out.append(related)
    return out[:LIMIT]


def _insert(conn: sqlite3.Connection, word_id: str, related: list[str]) -> int:
    conn.execute("DELETE FROM word_associations WHERE word_id = ?", (word_id,))
    conn.executemany(
        "INSERT INTO word_associations (word_id, related_id, rank) VALUES (?, ?, ?)",
        [(word_id, related_id, rank) for rank, related_id in enumerate(related, 1)],
    )
    return len(related)


def run(conn: sqlite3.Connection, limit: int | None = None) -> int:
    known = {r[0] for r in conn.execute("SELECT id FROM words")}
    cache = snapshots.load_word_associations()
    restored = restore(
        conn,
        "INSERT OR IGNORE INTO word_associations (word_id, related_id, rank) VALUES (?, ?, ?)",
        ((wid, rid, rank) for wid, ids in cache.items() if wid in known
         for rank, rid in enumerate(_clean(wid, ids, known), 1)),
    )
    if restored:
        print(f"  restored {restored} associations from snapshot")

    pending = [w for w in conn.execute("SELECT id, lemma, pos, english FROM words ORDER BY level, id")
               if w["id"] not in cache][:limit]
    system = _system(conn)

    def prompt(batch):
        return Prompt(
            system=system,
            user="Choose associated words for:\n\n"
                 + numbered(batch, lambda w: f"{w['id']}: {w['lemma']} ({w['pos']}, {w['english']})"),
            model=MODEL_BULK, max_tokens=4000, temperature=0.2,
        )

    def apply(batch, data):
        n = 0
        for w, ids in indexed(data, batch):
            cache[w["id"]] = related = _clean(w["id"], ids, known)
            n += _insert(conn, w["id"], related)
        return n

    return run_batches(conn, "associate words", pending, BATCH, prompt, apply,
                       lambda: snapshots.save_word_associations(cache))


if __name__ == "__main__":
    cli(run, "associations")
