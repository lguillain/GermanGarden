"""Report size, shape and integrity of the vocabulary DB.

Run after any loader (goethe_json, seed, tatoeba, ...) to confirm the table
is still clean.

    python -m pipeline.verify
    python -m pipeline.verify --strict   # exits non-zero if any check fails
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
import unicodedata

from .db import session


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    return "".join(ch for ch in s if not unicodedata.combining(ch)).lower()


# German separable-verb prefixes. "abfahren" shows up as "fahren ... ab" in
# sentences — if we don't strip the prefix, the lemma check misfires.
_SEPARABLE_PREFIXES = (
    "ab","an","auf","aus","bei","da","durch","ein","fest","her","hin","hinein",
    "los","mit","nach","statt","um","unter","vor","vorbei","weg","weiter","zu",
    "zurück","zusammen",
)


def _lemma_stems(lemma: str) -> list[str]:
    """One or more stems that should appear in any example of this lemma.

    - "sich bewerben" → ["bewerb"]  (reflexive "sich" is dropped — pronoun
      inflects to uns/euch/mich/dich in context)
    - "abfahren" → ["abfahr", "fahr"]   (separable: "Wir fahren ... ab.")
    - "all-" → ["all"]  (placeholder: lemma uses "-" to mark inflections)
    """
    base = re.split(r"\s+", lemma)[-1]
    base = base.rstrip("-")
    stems = {base}

    for ending in ("en", "ern", "eln", "e", "n"):
        if base.endswith(ending) and len(base) > len(ending) + 2:
            stems.add(base[: -len(ending)])
            break

    # Separable-verb alternative stem.
    for p in _SEPARABLE_PREFIXES:
        if base.startswith(p) and len(base) > len(p) + 2:
            rest = base[len(p):]
            stems.add(rest)
            for ending in ("en", "ern", "eln", "e", "n"):
                if rest.endswith(ending) and len(rest) > len(ending) + 2:
                    stems.add(rest[: -len(ending)])
                    break
            break

    return sorted(stems, key=len, reverse=True)


# ---------------------------- individual checks ----------------------------


def check_counts(conn: sqlite3.Connection) -> dict:
    counts = {
        "activities": conn.execute("SELECT COUNT(*) FROM activities").fetchone()[0],
        "words":      conn.execute("SELECT COUNT(*) FROM words").fetchone()[0],
        "tags":       conn.execute("SELECT COUNT(*) FROM word_activities").fetchone()[0],
        "sentences":  conn.execute("SELECT COUNT(*) FROM sentences").fetchone()[0],
    }
    by_level = dict(conn.execute("SELECT level, COUNT(*) FROM words GROUP BY level").fetchall())
    by_pos = dict(conn.execute("SELECT pos, COUNT(*) FROM words GROUP BY pos ORDER BY 2 DESC").fetchall())
    by_source = dict(conn.execute("SELECT source, COUNT(*) FROM sentences GROUP BY source").fetchall())
    return {"totals": counts, "by_level": by_level, "by_pos": by_pos, "by_source": by_source}


def check_duplicates(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Same (lemma, pos) stored under different ids — the loader shouldn't
    produce these. `Rezept` as noun+recipe-sense and noun+prescription-sense
    is fine because the IDs are the same slug anyway (upsert merges)."""
    return conn.execute(
        """
        SELECT lower(lemma) l, pos, COUNT(*) n,
               GROUP_CONCAT(id) ids, GROUP_CONCAT(level) levels
        FROM words
        GROUP BY lower(lemma), pos
        HAVING n > 1
        """
    ).fetchall()


def check_noun_articles(conn: sqlite3.Connection) -> tuple[int, int]:
    noun_no_art = conn.execute(
        "SELECT COUNT(*) FROM words WHERE pos='noun' AND article IS NULL"
    ).fetchone()[0]
    nonnoun_art = conn.execute(
        "SELECT COUNT(*) FROM words WHERE pos != 'noun' AND article IS NOT NULL"
    ).fetchone()[0]
    return noun_no_art, nonnoun_art


def check_lemma_in_sentence(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    """Each sentence should actually mention its target word (loose: stem
    containment, case-insensitive, umlaut-stripped)."""
    bad = []
    rows = conn.execute("""
        SELECT w.lemma, w.pos, s.text
        FROM sentences s JOIN words w ON w.id = s.word_id
    """).fetchall()
    for r in rows:
        text_n = _norm(r["text"])
        if not any(_norm(s) in text_n for s in _lemma_stems(r["lemma"])):
            bad.append((r["lemma"], r["text"]))
    return bad


def check_core_sentences(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """Words tagged in word_activities for an activity must have a sentence
    with that activity. Reports gaps (not errors — just a coverage view)."""
    return conn.execute(
        """
        SELECT w.id, w.lemma, wa.activity_id AS act
        FROM word_activities wa
        JOIN words w ON w.id = wa.word_id
        WHERE NOT EXISTS (
            SELECT 1 FROM sentences s
            WHERE s.word_id = wa.word_id AND s.activity_id = wa.activity_id
        )
        """
    ).fetchall()


def check_words_without_sentence(conn: sqlite3.Connection) -> int:
    return conn.execute(
        """
        SELECT COUNT(*) FROM words w
        WHERE NOT EXISTS (SELECT 1 FROM sentences s WHERE s.word_id = w.id)
        """
    ).fetchone()[0]


# ---------------------------- orchestrator ----------------------------


def run(strict: bool = False) -> int:
    failures = 0
    with session() as conn:
        info = check_counts(conn)
        print("Totals:")
        for k, v in info["totals"].items():
            print(f"  {k:12s} {v}")

        print("\nWords by level:")
        for lvl in ("A1", "A2", "B1"):
            print(f"  {lvl}: {info['by_level'].get(lvl, 0)}")

        print("\nWords by POS:")
        for p, n in info["by_pos"].items():
            print(f"  {p or '(none)':8s} {n}")

        print("\nSentences by source:")
        for src, n in info["by_source"].items():
            print(f"  {src:8s} {n}")

        # Integrity.
        dups = check_duplicates(conn)
        print(f"\n[check] duplicate (lemma, pos): {len(dups)}")
        if dups:
            failures += 1
            for d in dups[:5]:
                print(f"   - {d['l']} ({d['pos']}): ids={d['ids']} levels={d['levels']}")

        noun_no_art, nonnoun_art = check_noun_articles(conn)
        print(f"[check] nouns missing article:    {noun_no_art}")
        print(f"[check] non-nouns with article:   {nonnoun_art}")
        if noun_no_art or nonnoun_art:
            failures += 1

        # Approximate — strong-verb ablaut (sehen→sieht), contractions
        # (an+dem→am) and other German phenomena beat the regex. Treat as
        # informational, not a hard failure. Install spaCy for a proper check.
        bad = check_lemma_in_sentence(conn)
        rate = (len(bad) / max(info["totals"]["sentences"], 1)) * 100
        print(f"[info ] sentences without visible lemma stem: {len(bad)} ({rate:.1f}%)")
        if bad:
            for lemma, text in bad[:3]:
                print(f"   - {lemma!r}: {text!r}")

        orphans = check_core_sentences(conn)
        # Not a hard failure — but a visibility metric.
        print(f"[info ] tags lacking matching sentence: {len(orphans)}")

        no_sent = check_words_without_sentence(conn)
        print(f"[info ] words without any sentence: {no_sent}")

    print()
    if failures:
        print(f"✗ {failures} integrity check(s) failed")
        return 1 if strict else 0
    print("✓ integrity checks passed")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="exit with status 1 if any hard check fails")
    args = ap.parse_args()
    sys.exit(run(strict=args.strict))


if __name__ == "__main__":
    main()
