"""Fill in an English gloss for every word.

Snapshot: data/derived/word_english.json.

    python -m pipeline.translate              # all missing
    python -m pipeline.translate --limit 100  # just a slice (testing)
"""

from __future__ import annotations

import sqlite3

from . import snapshots
from .llm import MODEL_BULK, Prompt
from .steps import cli, indexed, label, numbered, restore, run_batches

BATCH = 50

SYSTEM = (
    "You translate German vocabulary into short, clear English glosses for "
    "a language-learning app.\n\n"
    "Rules per word:\n"
    "- Nouns: translate the noun. Do NOT include 'the' or 'a'.\n"
    "- Verbs: use the 'to X' infinitive form (e.g. 'to buy').\n"
    "- Reflexive verbs ('sich X'): use 'to X oneself' or the natural idiom "
    "('sich bewerben' → 'to apply').\n"
    "- Adjectives, adverbs, conjunctions, prepositions: use the plain English "
    "equivalent.\n"
    "- If a word has multiple common meanings, pick the most frequent one in "
    "everyday life; separate alternates with ' / '.\n"
    "- Keep glosses short (2–5 words max).\n\n"
    'Reply with STRICT JSON: {"<row number>": "<english>", ...}. No prose.'
)

_SET = "UPDATE words SET english = ? WHERE id = ? AND (english = '' OR english IS NULL)"


def run(conn: sqlite3.Connection, limit: int | None = None) -> int:
    cache = snapshots.load_word_english()
    restored = restore(conn, _SET, ((en, wid) for wid, en in cache.items()))
    if restored:
        print(f"  restored {restored} glosses from snapshot")

    pending = conn.execute(
        "SELECT id, lemma, article, pos FROM words "
        "WHERE english = '' OR english IS NULL ORDER BY level, id"
    ).fetchall()[:limit]

    def prompt(batch):
        return Prompt(
            system=SYSTEM,
            user="Translate these German words into English:\n\n"
                 + numbered(batch, lambda r: f"{label(r)}  ({r['pos']})"),
            model=MODEL_BULK, max_tokens=3000, temperature=0.2,
        )

    def apply(batch, data):
        n = 0
        for row, en in indexed(data, batch):
            if isinstance(en, str) and en.strip():
                cache[row["id"]] = en.strip()
                n += conn.execute(_SET, (en.strip(), row["id"])).rowcount
        return n

    return run_batches(conn, "translate", pending, BATCH, prompt, apply,
                       lambda: snapshots.save_word_english(cache))


if __name__ == "__main__":
    cli(run, "words translated via LLM")
