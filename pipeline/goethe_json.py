"""Load the hand-prepared Goethe JSON files into the DB.

Input: data/goethe/Goethe_{A1,A2,B1}_Wortliste.json
Schema (per level, under `.alphabetical_word_list.letters`):
    [{ "letter": "A",
       "entries": [
         { "headword": "...", "examples": [...], "page": N,
           "sub_entries": [...]   # optional, same shape
         },
         ...
       ]}]

Each headword can be:
  - a noun with article + optional plural suffix:
      "die Abbildung, -en"      → article die, lemma Abbildung, plural Abbildungen
      "das Haus, -ä, er"        → article das, lemma Haus,     plural Häuser
      "der Lehrer, -"           → article der, lemma Lehrer,   plural None
  - a verb with optional conjugation forms:
      "abgeben, gibt ab, hat abgegeben"
  - a reflexive verb:
      "sich bewerben, bewirbt sich, hat sich beworben"
  - a bare lemma: "ab", "aber", "abfahren"
  - a gender pair (split into two entries):
      "der Freund, -e / die Freundin, -nen"

Examples are strings in A1/A2, or {"number": n, "text": s} dicts in B1 —
each becomes one row in `sentences` with `activity_id=NULL` (no activity
assignment yet; that's a later LLM-powered step).

    python -m pipeline.goethe_json [A1] [A2] [B1]
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
import unicodedata
from pathlib import Path

from .db import ROOT, session

JSON_DIR = ROOT / "data" / "goethe"

ARTICLE_RE = re.compile(r"^(der|die|das)\s+", re.IGNORECASE)
SICH_RE = re.compile(r"^sich\s+", re.IGNORECASE)
PARENS_SICH_RE = re.compile(r"^\(sich\)\s+", re.IGNORECASE)

_ADV_WORDS = {
    "heute","morgen","gestern","dort","hier","oben","unten","vorn","hinten",
    "immer","nie","sehr","oft","schon","noch","bald","gleich","wieder",
    "wirklich","vielleicht","gerade","wohin","woher","wo","wann","warum","wie",
    "nur","auch","nicht","also","dann","danach","davor","doch","etwa","fast",
    "halt","hinaus","hinein","hinten","jetzt","leider","mal","meist","sofort",
    "zusammen","vielleicht",
}
_CONJ_WORDS = {
    "und","oder","aber","weil","dass","wenn","als","denn","sondern","ob",
    "nachdem","bevor","obwohl","während","damit","sodass","sowohl","entweder",
    "falls","trotzdem",
}
_PREP_WORDS = {
    "in","auf","unter","über","vor","hinter","neben","zwischen","an","bei",
    "mit","nach","seit","von","zu","aus","ohne","für","gegen","um","durch",
    "entlang","gegenüber","wegen","trotz","während","statt",
}

_VERB_HINT = re.compile(r"(en|ern|eln|ieren)$")


# ---------------------------- headword parsing ----------------------------


def _slug(pos: str, lemma: str) -> str:
    """Stable id — intentionally level-free. The same lemma that appears at
    A1 and B1 is one word; we record it at its lowest encountered level and
    merge the examples. See `load()` for load order."""
    s = unicodedata.normalize("NFKD", lemma)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = (s.replace("ß", "ss")
          .replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
          .replace("Ä", "ae").replace("Ö", "oe").replace("Ü", "ue"))
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()
    return f"{pos}_{s}"


def _umlaut(s: str) -> str:
    """Apply standard German umlauting to the last vowel of a stem."""
    for i in range(len(s) - 1, -1, -1):
        if s[i] in "aou":
            return s[:i] + {"a": "ä", "o": "ö", "u": "ü"}[s[i]] + s[i + 1:]
        if s[i] in "AOU":
            return s[:i] + {"A": "Ä", "O": "Ö", "U": "Ü"}[s[i]] + s[i + 1:]
    return s


def _parse_noun_tail(tail: str, lemma: str) -> str | None:
    """Turn Goethe plural notation into the full plural form.

    Examples:
        tail=" -en"    lemma=Abbildung → Abbildungen
        tail=" -e"     lemma=Hund      → Hunde
        tail=" -"      lemma=Lehrer    → None (no change — can't be an s-plural safely)
        tail=" -s"     lemma=Hobby     → Hobbys
        tail=" -ä, er" lemma=Haus      → Häuser
        tail=" -ü, e"  lemma=Zug       → Züge
        tail=" -nen"   lemma=Lehrerin  → Lehrerinnen
    """
    t = tail.strip().strip(",").strip()
    if not t or t in ("-", "–", "—"):
        return None

    # Umlaut forms: "-ä, er" or "-ü, e"
    m = re.match(r"^-([äöüÄÖÜ])\s*,\s*(\w+)$", t)
    if m:
        umlauted = _umlaut(lemma)
        return umlauted + m.group(2)

    # Plain suffix: "-en", "-e", "-s", "-nen", ...
    m = re.match(r"^-(\w+)$", t)
    if m:
        return lemma + m.group(1)

    # Something unusual — leave None rather than guess.
    return None


def _looks_like_verb(lemma: str, tail: list[str]) -> bool:
    # A conjugation tail like "gibt ab", "hat abgegeben" is a strong hint.
    for t in tail:
        if re.search(r"\b(hat|ist|habe|haben)\b", t):
            return True
        if re.search(r"\b(gibt|nimmt|liest|fährt|läuft)\b", t):
            return True
    if _VERB_HINT.search(lemma.lower()) and lemma[0].islower():
        return True
    return False


def _guess_pos_lower(lemma: str) -> str:
    low = lemma.lower()
    if low in _CONJ_WORDS: return "conj"
    if low in _ADV_WORDS:  return "adv"
    if low in _PREP_WORDS: return "prep"
    if _VERB_HINT.search(low): return "verb"
    return "other"


def _parse_single(headword: str, level: str) -> dict | None:
    """Parse a single headword (post-split on ' / ') into a word entry."""
    hw = headword.strip()
    if not hw:
        return None

    reflexive = False
    optional_sich = False
    if PARENS_SICH_RE.match(hw):
        optional_sich = True
        hw = hw[len("(sich)"):].strip()
    elif SICH_RE.match(hw):
        reflexive = True
        hw = hw[len("sich"):].strip()

    parts = [p.strip() for p in hw.split(",")]
    head = parts[0]
    tail = parts[1:]

    article = None
    m = ARTICLE_RE.match(head)
    if m:
        article = m.group(1).lower()
        head = head[m.end():].strip()

    # Strip any trailing qualifier in parens like "(D)" "(A, CH)" from the lemma head.
    head = re.sub(r"\s*\([^)]*\)\s*$", "", head).strip()
    head = head.rstrip("/").strip()

    # Compound alt-forms separated by slash INSIDE the head (e.g. "ab-/anmelden") — keep as-is.
    if not head:
        return None

    # Prefix placeholders like "Haupt-", "herunter-", "irgend-" — these are
    # productive compounding prefixes documented in the Goethe list, not
    # standalone words. The learner can't swipe on them meaningfully.
    if head.endswith("-"):
        return None

    lemma = head

    if article:
        pos = "noun"
    elif reflexive or _looks_like_verb(lemma, tail):
        pos = "verb"
    else:
        pos = _guess_pos_lower(lemma)

    plural = _parse_noun_tail(", ".join(tail[:2]), lemma) if (pos == "noun" and tail) else None

    display_lemma = lemma
    if reflexive:
        display_lemma = "sich " + lemma
    elif optional_sich:
        display_lemma = "(sich) " + lemma

    return {
        "id": _slug(pos, (("sich_" if reflexive else "") + lemma)),
        "lemma": display_lemma,
        "article": article,
        "plural": plural,
        "pos": pos,
        "english": "",
        "level": level,
        "goethe_headword": headword.strip(),
    }


def parse_headword(headword: str, level: str) -> list[dict]:
    """A headword string → one or more word entries.

    Splits on " / " when BOTH sides look like independent full entries
    (e.g. "der Freund, -e / die Freundin, -nen"). Does NOT split a slash
    that is part of a lemma like "ab-/anmelden" (we leave those as-is).
    """
    # Split only on " / " surrounded by spaces — gender pairs are written that way.
    chunks = re.split(r"\s/\s", headword)
    # If any chunk doesn't contain a potential lemma head (e.g. "-nen"), treat
    # as a continuation and don't split.
    if len(chunks) > 1 and all(ARTICLE_RE.match(c.strip()) or SICH_RE.match(c.strip()) or re.match(r"^[A-Za-zäöüÄÖÜß]", c.strip()) for c in chunks):
        results = []
        for c in chunks:
            w = _parse_single(c, level)
            if w:
                results.append(w)
        return results
    w = _parse_single(headword, level)
    return [w] if w else []


# ---------------------------- example parsing ----------------------------


def _example_texts(examples: list) -> list[str]:
    out = []
    for e in examples or []:
        if isinstance(e, str):
            t = e.strip()
        elif isinstance(e, dict):
            t = (e.get("text") or "").strip()
        else:
            continue
        if t:
            out.append(t)
    return out


# ---------------------------- DB ----------------------------


def _upsert_word(conn: sqlite3.Connection, w: dict) -> None:
    # First encounter wins (lowest level, since we load A1→A2→B1). Later
    # encounters only enrich fields that are still empty.
    conn.execute(
        """
        INSERT INTO words (id, lemma, article, plural, pos, english, level)
        VALUES (:id, :lemma, :article, :plural, :pos, :english, :level)
        ON CONFLICT(id) DO UPDATE SET
            article = COALESCE(words.article, excluded.article),
            plural  = COALESCE(words.plural,  excluded.plural),
            english = CASE WHEN words.english = '' THEN excluded.english ELSE words.english END
        """,
        {k: w[k] for k in ("id","lemma","article","plural","pos","english","level")},
    )


def _insert_sentences(conn: sqlite3.Connection, word_id: str, texts: list[str]) -> int:
    # Dedupe against what's already there for this word.
    existing = {
        r[0] for r in conn.execute(
            "SELECT text FROM sentences WHERE word_id = ?", (word_id,)
        )
    }
    n = 0
    for t in texts:
        if t in existing:
            continue
        conn.execute(
            """
            INSERT INTO sentences (word_id, activity_id, text, english, source)
            VALUES (?, NULL, ?, '', 'goethe')
            """,
            (word_id, t),
        )
        n += 1
    return n


def _walk_entries(entries: list, level: str, conn, counts):
    for entry in entries or []:
        hw = entry.get("headword", "").strip()
        if not hw:
            continue
        words = parse_headword(hw, level)
        if not words:
            counts["unparsed"] += 1
            counts["unparsed_examples"].append(hw)
            continue
        texts = _example_texts(entry.get("examples"))
        for w in words:
            _upsert_word(conn, w)
            counts["words"] += 1
            counts["sentences"] += _insert_sentences(conn, w["id"], texts)
        # Recurse into sub-entries (same shape).
        subs = entry.get("sub_entries")
        if subs:
            _walk_entries(subs, level, conn, counts)


# ---------------------------- top-level ----------------------------

# The 'goethe' source is additional to pipeline.llm's constraint, so we need
# to relax the sentences.source CHECK before inserting. We can't ALTER a CHECK
# in SQLite without rewriting; instead we temporarily use 'llm' as the source
# marker — then annotate via a note. Simpler: just use 'tatoeba' is wrong,
# 'llm' is wrong, 'goethe' is correct but not in CHECK. Let's extend schema.

def _ensure_goethe_source(conn: sqlite3.Connection) -> None:
    # Schema CHECK only allows 'tatoeba' or 'llm'. We need 'goethe' too.
    # We rebuild `sentences` if needed. Safe + idempotent.
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='sentences'"
    ).fetchone()
    if not row or "'goethe'" in row[0]:
        return
    print("  (migrating sentences table to allow source='goethe')")
    conn.executescript(
        """
        BEGIN;
        CREATE TABLE sentences__new (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          word_id     TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
          activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
          text        TEXT NOT NULL,
          english     TEXT NOT NULL,
          source      TEXT NOT NULL CHECK (source IN ('tatoeba','llm','goethe')),
          tatoeba_id  INTEGER
        );
        INSERT INTO sentences__new SELECT * FROM sentences;
        DROP TABLE sentences;
        ALTER TABLE sentences__new RENAME TO sentences;
        CREATE INDEX IF NOT EXISTS idx_sentences_word_activity
          ON sentences(word_id, activity_id);
        COMMIT;
        """
    )


def load(levels: list[str] | None = None) -> dict:
    levels = levels or ["A1", "A2", "B1"]
    counts = {"words": 0, "sentences": 0, "unparsed": 0, "unparsed_examples": []}

    with session() as conn:
        _ensure_goethe_source(conn)
        for lvl in levels:
            path = JSON_DIR / f"Goethe_{lvl}_Wortliste.json"
            if not path.exists():
                print(f"missing {path}")
                continue
            data = json.load(path.open(encoding="utf-8"))
            letters = data.get("alphabetical_word_list", {}).get("letters", [])
            for block in letters:
                _walk_entries(block.get("entries"), lvl, conn, counts)
            # Also walk `word_groups` if present — days, numbers, months.
            for g in data.get("word_groups", {}).get("groups", []) if isinstance(data.get("word_groups"), dict) else []:
                _walk_entries(g.get("entries"), lvl, conn, counts)
    return counts


def main() -> None:
    levels = sys.argv[1:] or ["A1", "A2", "B1"]
    c = load(levels)
    print(f"loaded {c['words']} word entries, {c['sentences']} example sentences")
    if c["unparsed"]:
        print(f"skipped {c['unparsed']} unparseable headwords; samples:")
        for s in c["unparsed_examples"][:10]:
            print(f"  - {s!r}")


if __name__ == "__main__":
    main()
