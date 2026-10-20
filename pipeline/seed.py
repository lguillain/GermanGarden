"""Load the hand-curated sample dataset from samples/vocab.py into the DB.

Idempotent: safe to re-run; uses INSERT OR REPLACE / IGNORE semantics.

    python -m pipeline.seed
"""

from __future__ import annotations

import sys

from .db import ROOT, session

# Make samples/vocab.py importable without turning samples/ into a package.
sys.path.insert(0, str(ROOT / "samples"))
import vocab  # type: ignore[import-not-found]  # noqa: E402


def load() -> dict[str, int]:
    counts = {"activities": 0, "words": 0, "tags": 0, "sentences": 0}
    with session() as conn:
        for aid, name, desc in vocab.ACTIVITIES:
            conn.execute(
                "INSERT INTO activities (id, name, description) VALUES (?, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description",
                (aid, name, desc),
            )
            counts["activities"] += 1

        for w in vocab.ALL_WORDS:
            conn.execute(
                """
                INSERT INTO words (id, lemma, article, plural, pos, english, level)
                VALUES (:id, :lemma, :article, :plural, :pos, :english, :level)
                ON CONFLICT(id) DO UPDATE SET
                    lemma=excluded.lemma, article=excluded.article,
                    plural=excluded.plural, pos=excluded.pos,
                    english=excluded.english, level=excluded.level
                """,
                w,
            )
            counts["words"] += 1

            for act_id, rel in w["activities"].items():
                conn.execute(
                    """
                    INSERT INTO word_activities (word_id, activity_id, relevance)
                    VALUES (?, ?, ?)
                    ON CONFLICT(word_id, activity_id) DO UPDATE SET relevance=excluded.relevance
                    """,
                    (w["id"], act_id, rel),
                )
                counts["tags"] += 1

            # Clear & re-insert sentences for this word so edits in vocab.py
            # propagate on re-seed.
            conn.execute("DELETE FROM sentences WHERE word_id = ?", (w["id"],))
            for s in w["sentences"]:
                conn.execute(
                    """
                    INSERT INTO sentences (word_id, activity_id, text, english, source)
                    VALUES (?, ?, ?, ?, 'llm')
                    """,
                    (w["id"], s.get("activity"), s["de"], s["en"]),
                )
                counts["sentences"] += 1

        # Prune tags that have no matching sentence — the feed draws from
        # the join of word_activities and sentences, so an unmatched tag is
        # dead weight. Keeping the table clean makes exports and debugging
        # less confusing.
        pruned = conn.execute(
            """
            DELETE FROM word_activities
            WHERE (word_id, activity_id) NOT IN (
                SELECT word_id, activity_id FROM sentences
                WHERE activity_id IS NOT NULL
            )
            """
        ).rowcount
        counts["pruned_tags"] = pruned

    return counts


def main() -> None:
    counts = load()
    kept_tags = counts["tags"] - counts.get("pruned_tags", 0)
    print(
        f"Seed loaded: {counts['activities']} activities, {counts['words']} words, "
        f"{kept_tags} tags (pruned {counts.get('pruned_tags', 0)} without sentence), "
        f"{counts['sentences']} sentences"
    )


if __name__ == "__main__":
    main()
