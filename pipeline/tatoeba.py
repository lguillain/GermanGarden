"""Match Tatoeba de-en sentence pairs to words and (optionally) activities.

Expects two files from https://tatoeba.org/en/downloads under data/tatoeba/:
    sentences.csv  — id \\t lang \\t text        (lang in {"deu","eng",...})
    links.csv      — sentence_id \\t translation_id

Steps:
  1. Stream Tatoeba, keep deu sentences and their eng translations.
  2. Lemmatize each deu sentence with spaCy; index lemma -> [tatoeba_ids].
  3. For each word in the DB, take up to K Tatoeba candidates whose lemmas
     contain the word's lemma, pick the shortest few.
  4. Insert into `sentences` (source='tatoeba', activity_id=NULL); dedupe on
     (word_id, text).

No LLM here: pipeline.enrich_sentences assigns activities afterwards, with
the same prompt and snapshot as the Goethe examples. Run this BEFORE
pipeline.sentences so the LLM only writes sentences Tatoeba couldn't supply.
"""

from __future__ import annotations

import csv
import sqlite3
from collections import defaultdict

from .db import ROOT

TATOEBA_DIR = ROOT / "data" / "tatoeba"
CANDIDATES_PER_WORD = 5


def _load_spacy():
    """The German spaCy pipeline, or None (with a hint) if it isn't installed."""
    try:
        import spacy
        return spacy.load("de_core_news_sm", disable=["parser", "ner"])
    except (ImportError, OSError):
        print("  spaCy / de_core_news_sm not installed, skipping Tatoeba. To enable: "
              "pip install spacy && python -m spacy download de_core_news_sm")
        return None


def _load_pairs() -> dict[int, tuple[str, str]]:
    """Return {deu_id: (deu_text, eng_text)} for every deu sentence that has an eng link."""
    sentences_path = TATOEBA_DIR / "sentences.csv"
    links_path = TATOEBA_DIR / "links.csv"
    if not (sentences_path.exists() and links_path.exists()):
        print(f"  no Tatoeba data at {TATOEBA_DIR}, skipping")
        return {}

    deu: dict[int, str] = {}
    eng: dict[int, str] = {}
    with sentences_path.open(encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) < 3:
                continue
            sid, lang, text = row[0], row[1], row[2]
            if lang == "deu":
                deu[int(sid)] = text
            elif lang == "eng":
                eng[int(sid)] = text

    pairs: dict[int, tuple[str, str]] = {}
    with links_path.open(encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) < 2:
                continue
            a, b = int(row[0]), int(row[1])
            if a in deu and b in eng and a not in pairs:
                pairs[a] = (deu[a], eng[b])
    return pairs


def _lemma_index(pairs, nlp) -> dict[str, list[int]]:
    index: dict[str, list[int]] = defaultdict(list)
    texts = [p[0] for p in pairs.values()]
    ids = list(pairs.keys())
    for i, doc in enumerate(nlp.pipe(texts, batch_size=200)):
        for tok in doc:
            if tok.is_alpha:
                index[tok.lemma_.lower()].append(ids[i])
    return index


def match(conn: sqlite3.Connection) -> int:
    pairs = _load_pairs()
    if not pairs:
        return 0

    nlp = _load_spacy()
    if nlp is None:
        return 0
    print(f"  loaded {len(pairs)} Tatoeba de-en pairs; lemmatizing...")
    index = _lemma_index(pairs, nlp)

    words = conn.execute("SELECT id, lemma FROM words").fetchall()
    inserted = 0
    for w in words:
        hits = index.get(w["lemma"].lower(), [])
        for tid in sorted(hits, key=lambda tid: len(pairs[tid][0]))[:CANDIDATES_PER_WORD]:
            deu, eng = pairs[tid]
            inserted += conn.execute(
                """
                INSERT INTO sentences (word_id, activity_id, text, english, source, tatoeba_id)
                SELECT ?, NULL, ?, ?, 'tatoeba', ?
                WHERE NOT EXISTS (SELECT 1 FROM sentences WHERE word_id = ? AND text = ?)
                """,
                (w["id"], deu, eng, tid, w["id"], deu),
            ).rowcount

    conn.commit()
    return inserted


if __name__ == "__main__":
    from .db import session
    with session() as conn:
        n = match(conn)
        print(f"Inserted {n} Tatoeba sentences")
