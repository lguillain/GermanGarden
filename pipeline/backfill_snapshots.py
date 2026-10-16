"""Dump the current DB's LLM-derived state into snapshot JSONs.

One-shot utility for projects that already ran the pipeline before snapshots
existed. Reads every enriched row from the DB, writes it to the appropriate
`data/derived/*.json`. Safe to re-run: it's a snapshot of the CURRENT DB.

    python -m pipeline.backfill_snapshots
"""

from __future__ import annotations

from . import snapshots
from .db import session


def main() -> None:
    with session() as conn:
        # Word English.
        rows = conn.execute(
            "SELECT id, english FROM words WHERE english != '' AND english IS NOT NULL"
        ).fetchall()
        snapshots.save_word_english({r["id"]: r["english"] for r in rows})
        print(f"  word_english.json         ← {len(rows)} entries")

        # Word → activities.
        rows = conn.execute(
            "SELECT word_id, activity_id, relevance FROM word_activities"
        ).fetchall()
        # Core words have no DB rows; keep their {} verdicts from the existing
        # snapshot, or every later run would pay to re-tag them.
        tags: dict[str, dict[str, int]] = {
            wid: {} for wid, v in snapshots.load_word_activities().items() if not v
        }
        for r in rows:
            tags.setdefault(r["word_id"], {})[r["activity_id"]] = int(r["relevance"])
        snapshots.save_word_activities(tags)
        print(f"  word_activities.json      ← {sum(len(v) for v in tags.values())} tags "
              f"across {len(tags)} words")

        # Goethe / Tatoeba sentence → activity assignment.
        rows = conn.execute(
            "SELECT word_id, text, activity_id FROM sentences WHERE source != 'llm'"
        ).fetchall()
        snapshots.save_sentence_activities(
            {(r["word_id"], r["text"]): r["activity_id"] for r in rows}
        )
        print(f"  sentence_activities.json  ← {len(rows)} Goethe/Tatoeba sentences")

        # Sentence → English.
        rows = conn.execute(
            "SELECT word_id, text, english FROM sentences "
            "WHERE english != '' AND english IS NOT NULL"
        ).fetchall()
        snapshots.save_sentence_english(
            {(r["word_id"], r["text"]): r["english"] for r in rows}
        )
        print(f"  sentence_english.json     ← {len(rows)} translations")

        # LLM-generated sentences (one per (word, activity)).
        rows = conn.execute(
            "SELECT word_id, activity_id, text, english FROM sentences WHERE source = 'llm'"
        ).fetchall()
        gen = {
            (r["word_id"], r["activity_id"]): {
                "word_id": r["word_id"],
                "activity_id": r["activity_id"],
                "de": r["text"],
                "en": r["english"] or "",
            }
            for r in rows
        }
        snapshots.save_generated_sentences(gen)
        print(f"  generated_sentences.json  ← {len(gen)} rows")


if __name__ == "__main__":
    main()
