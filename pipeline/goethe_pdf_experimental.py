"""Parse the official Goethe-Institut Wortliste PDFs into TSV.

Approach:
  1. For each PDF, scan every page and locate word clusters at specific x0
     positions. The alphabetical list has a tight "lemma column" at a fixed
     x0 that preamble/intro pages do not share.
  2. Only process pages where the lemma column is strong (≥ 8 lemma-shaped
     lines) and lies within a known layout (1 col for A1, 2 cols for A2/B1).
  3. On those pages, a line is a LEMMA line iff its lemma-column text matches
     the strict `LEMMA_HEAD` regex: a single word (plus optional article /
     `sich` / parenthetical), with an optional ", <plural suffix>" tail.
  4. Non-lemma lines on a list page are continuation example sentences for
     the current entry (not emitted as separate lemmas).

Output: tab-separated `lemma, pos, article, plural, english` under
`data/goethe/{A1,A2,B1}.tsv`. English is left blank — the Goethe lists are
German-only. Fill via `pipeline.build` or by hand.
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber

from .db import ROOT

PDF_DIR = ROOT / "data" / "goethe" / "pdf"
OUT_DIR = ROOT / "data" / "goethe"

# A valid lemma head. Enforces single-word lemma (hyphens OK). Example:
#   "der Hund, -e"
#   "die Lebens-"          (continuation hyphen, handled later)
#   "sich kümmern"
#   "(Kredit)-Karte, -n"
#   "heiraten"
#   "jed-"
LEMMA_HEAD = re.compile(
    r"""^(?:
          (?P<article>der|die|das)(?:/(?:der|die|das))?\s+
          (?P<noun>\(?[A-ZÄÖÜ][\wäöüÄÖÜß\-()]*)
          (?:\s*,\s*(?P<plural>[^A-Z][^\s,]*(?:,\s*[\wäöü\-]+)?))?
        | sich\s+(?P<reflexive>[a-zäöüß][\wäöüß\-]*)
        | (?P<lower>[a-zäöüß(][\wäöüß\-()\.]*)-?    # verb/adj/adv/conj etc.
            (?:\s*,\s*(?P<lowtail>[^A-Z][^\s,]*))?
      )\s*$
    """,
    re.VERBOSE,
)

# "sentences", "list", page numbers, chapter titles — never valid lemmas.
NOISE_WORDS = {
    "und","der","die","das","in","auf","von","mit","für","zu","zur","zum",
    "bei","als","an","am","im","dem","den","des","ein","eine","einer",
    "eines","einen","einem","ist","sind","war","sein","hat","haben","wie",
    "oder","aber","nicht","nur","auch","noch","so","dass","was","wenn",
    "etc.","z.","B.","bzw.","usw.","i.","d.","R.",
}

LEVEL_LAYOUT = {
    "A1": {"n_cols": 1, "min_lemmas_per_page": 10},
    "A2": {"n_cols": 2, "min_lemmas_per_page": 10},
    "B1": {"n_cols": 2, "min_lemmas_per_page": 10},
}


# ---------------------------- page column analysis ----------------------------


def _lemma_column_x0(words: list[dict], n_cols: int) -> list[float]:
    """Return the x0 position(s) of the lemma column(s) on a page.

    We look at the most common small-numbered x0 (the leftmost column) and,
    for 2-column layouts, the leftmost x0 in the right half.
    """
    if not words:
        return []
    xs = [w["x0"] for w in words]
    page_right = max(w["x1"] for w in words)
    page_mid = (min(xs) + page_right) / 2

    def mode_x0(filtered: list[float]) -> float | None:
        if not filtered:
            return None
        # Round into 2pt buckets, take the most common.
        c = Counter(round(x / 2.0) * 2 for x in filtered)
        return float(c.most_common(1)[0][0])

    left_mode = mode_x0([x for x in xs if x < page_mid])
    if n_cols == 1:
        return [left_mode] if left_mode is not None else []
    right_mode = mode_x0([x for x in xs if x >= page_mid])
    return [x for x in (left_mode, right_mode) if x is not None]


def _group_lines(words: list[dict]) -> list[list[dict]]:
    """Group words by y position into lines."""
    rows: dict[int, list[dict]] = defaultdict(list)
    for w in words:
        key = int(round(w["top"] / 2.0))
        rows[key].append(w)
    return [sorted(rows[k], key=lambda w: w["x0"]) for k in sorted(rows)]


def _split_line_column(line: list[dict], lemma_x0: float) -> tuple[str, str]:
    """Return (lemma-column text, example-column text) for a line, split by
    the gap after the lemma column."""
    EPS = 2.0
    EXAMPLE_GAP = 25.0  # example column is at least this many pt right of lemma

    lemma_tokens, example_tokens = [], []
    example_x_start = None
    for w in line:
        if lemma_x0 - EPS <= w["x0"] < lemma_x0 + EXAMPLE_GAP:
            lemma_tokens.append(w)
        elif w["x0"] >= lemma_x0 + EXAMPLE_GAP:
            if example_x_start is None:
                example_x_start = w["x0"]
            example_tokens.append(w)
    # If lemma_tokens span more than ~50pt horizontally, we probably mis-grouped
    # a preamble line. Treat as no lemma.
    if lemma_tokens:
        span = lemma_tokens[-1]["x1"] - lemma_tokens[0]["x0"]
        if span > 90.0:
            lemma_tokens = []
    return (
        " ".join(w["text"] for w in lemma_tokens).strip(),
        " ".join(w["text"] for w in example_tokens).strip(),
    )


# ---------------------------- lemma parsing ----------------------------


def _parse_head(text: str) -> dict | None:
    if not text or text in NOISE_WORDS:
        return None
    m = LEMMA_HEAD.match(text)
    if not m:
        return None

    if m.group("article"):
        lemma = m.group("noun").strip()
        if lemma.lower() in NOISE_WORDS or not lemma[0].isalpha() and not lemma[0] == "(":
            return None
        plural = _normalize_plural(m.group("plural") or "", lemma)
        return {
            "lemma": lemma,
            "article": m.group("article").lower(),
            "plural": plural,
            "pos": "noun",
        }

    if m.group("reflexive"):
        return {
            "lemma": "sich " + m.group("reflexive"),
            "article": None, "plural": None, "pos": "verb",
        }

    if m.group("lower"):
        lemma = m.group("lower").rstrip(".-")
        if not lemma or lemma in NOISE_WORDS or len(lemma) < 2:
            return None
        return {"lemma": lemma, "article": None, "plural": None, "pos": _guess_pos(lemma)}

    return None


def _normalize_plural(raw: str, lemma: str) -> str | None:
    r = raw.strip().rstrip(",").strip()
    if not r or r in ("–", "-", "—"):
        return None
    if "pl." in r.lower():
        return lemma
    if r.startswith("-"):
        return (lemma + r[1:]).strip()
    if r.startswith(("ä","ö","ü","Ä","Ö","Ü")) and "," in raw:
        _, suffix = raw.split(",", 1)
        suf = suffix.strip().lstrip("-")
        return (lemma + suf).strip() if suf else None
    return r.replace(" ", "").strip() or None


_VERB_SUFFIX = re.compile(r"(en|ern|eln|ieren)$")
_ADV_WORDS = {"heute","morgen","gestern","dort","hier","oben","unten","vorn","hinten",
              "immer","nie","sehr","oft","schon","noch","bald","gleich","wieder",
              "wirklich","vielleicht","gerade","wohin","woher","wo","wann","warum","wie"}
_CONJ_WORDS = {"und","oder","aber","weil","dass","wenn","als","denn","sondern","ob",
               "nachdem","bevor","obwohl","während","damit","sodass"}


def _guess_pos(lemma: str) -> str:
    low = lemma.lower()
    if low in _CONJ_WORDS: return "conj"
    if low in _ADV_WORDS:  return "adv"
    if _VERB_SUFFIX.search(low): return "verb"
    return "other"


# ---------------------------- extract ----------------------------


def extract(pdf_path: Path, layout: dict) -> list[dict]:
    n_cols = layout["n_cols"]
    min_lemmas = layout["min_lemmas_per_page"]
    entries: list[dict] = []
    current: dict | None = None

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words()
            if not words:
                continue
            col_x0s = _lemma_column_x0(words, n_cols)
            if not col_x0s:
                continue

            # For each column: pull lines, decide lemma vs continuation.
            page_lemma_count = 0
            per_col_entries: list[list[dict]] = []

            for lemma_x0 in col_x0s:
                col_words = [w for w in words if lemma_x0 - 2 <= w["x0"] < lemma_x0 + 400]
                col_lines = _group_lines(col_words)
                col_entries: list[dict] = []
                col_current: dict | None = None
                for line in col_lines:
                    lemma_text, example_text = _split_line_column(line, lemma_x0)
                    head = _parse_head(lemma_text) if lemma_text else None
                    if head:
                        if col_current:
                            col_entries.append(col_current)
                        col_current = {**head, "examples": []}
                        if example_text:
                            col_current["examples"].append(example_text)
                        page_lemma_count += 1
                    elif col_current and example_text and not lemma_text:
                        col_current["examples"].append(example_text)
                if col_current:
                    col_entries.append(col_current)
                per_col_entries.append(col_entries)

            # Reject pages that look like preamble (too few lemmas).
            if page_lemma_count < min_lemmas:
                continue

            for col_entries in per_col_entries:
                entries.extend(col_entries)

    # Dedupe on (lemma, pos, article).
    seen = set()
    unique = []
    for e in entries:
        key = (e["lemma"].lower(), e["pos"], e.get("article"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)
    return unique


def write_tsv(level: str, entries: list[dict]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{level}.tsv"
    with out.open("w", encoding="utf-8") as f:
        f.write("# lemma\tpos\tarticle\tplural\tenglish\n")
        for e in entries:
            f.write(
                f"{e['lemma']}\t{e['pos']}\t"
                f"{e.get('article') or ''}\t{e.get('plural') or ''}\t\n"
            )
    return out


def main() -> None:
    levels = sys.argv[1:] or ["A1", "A2", "B1"]
    for lvl in levels:
        pdf = PDF_DIR / f"{lvl}.pdf"
        if not pdf.exists():
            print(f"missing {pdf}")
            continue
        entries = extract(pdf, LEVEL_LAYOUT[lvl])
        out = write_tsv(lvl, entries)
        print(f"{lvl}: {len(entries):4d} entries → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
