"""Fill in what existing (Goethe / Tatoeba) example sentences are missing,
in ONE pass over the sentences:

- `english`: an idiomatic translation, for sentences that have none
  (the Goethe JSONs are German-only; Tatoeba pairs already carry one).
- `activity_id`: which of the word's tagged activities the sentence fits,
  or "none" for a generic example. Only asked for words that have tags;
  for pure "core" words the sentence stays `activity_id=NULL`.

Both answers come back from the same call, so each sentence's text is sent
once. Verdicts — including "none" — go to the snapshots
(data/derived/sentence_english.json, sentence_activities.json), so a
re-run never re-asks about a sentence it has already seen.

    python -m pipeline.enrich_sentences [--limit N]
"""

from __future__ import annotations

import sqlite3
from collections import defaultdict

from . import snapshots
from .llm import MODEL_BULK, Prompt
from .steps import cli, indexed, label, numbered, restore, run_batches

BATCH = 25

SYSTEM = (
    "You enrich German example sentences for a vocabulary-learning app. Each "
    "row gives the target word, the sentence, and which fields to return:\n\n"
    "- en: a short, natural, idiomatic English translation. Keep the register "
    "of the German (casual stays casual, formal stays formal). No "
    "explanations, no '[literal: ...]' hints. If the German is obviously "
    "broken, render what it clearly meant.\n"
    "- act: which of the row's candidate activities the sentence best belongs "
    "to in an everyday-life context, or \"none\" if none fits clearly "
    "(generic small talk, abstract, or neutral statement). MUST be one of "
    "that row's candidate ids — don't invent new ones.\n\n"
    "Return only the fields each row asks for.\n\n"
    'Reply with STRICT JSON: {"<row number>": {"en": "...", "act": "..."}, ...}. '
    "No prose, no markdown."
)

_SET_EN = "UPDATE sentences SET english = ? WHERE word_id = ? AND text = ? AND (english = '' OR english IS NULL)"
_SET_ACT = "UPDATE sentences SET activity_id = ? WHERE word_id = ? AND text = ? AND activity_id IS NULL"


def _word_candidates(conn: sqlite3.Connection) -> dict[str, list[sqlite3.Row]]:
    by_word = defaultdict(list)
    for r in conn.execute(
        "SELECT wa.word_id, a.id, a.name FROM word_activities wa "
        "JOIN activities a ON a.id = wa.activity_id ORDER BY wa.relevance DESC"
    ):
        by_word[r["word_id"]].append(r)
    return by_word


def _str(item: dict, key: str) -> str:
    v = item.get(key)
    return v.strip() if isinstance(v, str) else ""


def _row(r: dict) -> str:
    wants = []
    if r["need_en"]:
        wants.append("en")
    if r["cand_rows"]:
        wants.append("act (candidates: "
                     + "; ".join(f"{c['id']} ({c['name']})" for c in r["cand_rows"]) + ")")
    return f"word: {r['label']!r} | sentence: {r['text']} | return: {', '.join(wants)}"


def run(conn: sqlite3.Connection, limit: int | None = None) -> int:
    en_cache = snapshots.load_sentence_english()
    act_cache = snapshots.load_sentence_activities()
    n = restore(conn, _SET_EN, ((en, w, t) for (w, t), en in en_cache.items()))
    n += restore(conn, _SET_ACT, ((a, w, t) for (w, t), a in act_cache.items() if a))
    if n:
        print(f"  restored {n} sentence fields from snapshot")

    cands_by_word = _word_candidates(conn)
    pending = []
    for s in conn.execute(
        "SELECT s.word_id, s.text, s.english, s.activity_id, w.lemma, w.article "
        "FROM sentences s JOIN words w ON w.id = s.word_id "
        "WHERE s.source IN ('goethe', 'tatoeba') ORDER BY s.id"
    ):
        key = (s["word_id"], s["text"])
        need_en = not s["english"]
        cands = (cands_by_word.get(s["word_id"], [])
                 if s["activity_id"] is None and key not in act_cache else [])
        if need_en or cands:
            pending.append({"key": key, "text": s["text"], "label": label(s),
                            "need_en": need_en, "cands": {c["id"] for c in cands},
                            "cand_rows": cands})
    pending = pending[:limit]

    def prompt(batch):
        return Prompt(
            system=SYSTEM,
            user="Sentences:\n\n" + numbered(batch, _row),
            model=MODEL_BULK, max_tokens=3000, temperature=0.2,
        )

    def apply(batch, data):
        filled = 0
        for r, item in indexed(data, batch):
            if not isinstance(item, dict):
                continue
            w, t = r["key"]
            en, act = _str(item, "en"), _str(item, "act")
            if r["need_en"] and en:
                en_cache[r["key"]] = en
                filled += conn.execute(_SET_EN, (en, w, t)).rowcount
            if r["cands"] and (act == "none" or act in r["cands"]):
                act_cache[r["key"]] = None if act == "none" else act   # "none" is a verdict too
                if act != "none":
                    filled += conn.execute(_SET_ACT, (act, w, t)).rowcount
        return filled

    def save():
        snapshots.save_sentence_english(en_cache)
        snapshots.save_sentence_activities(act_cache)

    return run_batches(conn, "enrich sentences", pending, BATCH, prompt, apply, save)


if __name__ == "__main__":
    cli(run, "sentence fields filled via LLM")
