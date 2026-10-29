"""Durable snapshots of LLM-derived data.

Every LLM pipeline step writes its output to a plain JSON file under
`data/derived/`. The DB (`data/vocab.sqlite`) is a **cache** rebuilt from the
Goethe JSONs + these snapshots; the snapshots themselves are the source of
truth for the LLM-produced layer. They're small, human-readable, diffable in
git, and let `pipeline.*` runs skip the LLM entirely if the snapshot already
holds the answer.

Convention:
    load_<kind>()   → dict/list of what we know so far (empty if no file)
    save_<kind>()   → atomic overwrite with the given data

Keep schemas minimal and self-describing. If you add a new LLM step, add a
pair of helpers here.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from .db import ROOT

DERIVED = ROOT / "data" / "derived"


# ---------------------------- generic I/O ----------------------------


def _atomic_write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp-", suffix=".json", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        os.replace(tmp, path)
    except Exception:
        try: os.unlink(tmp)
        except OSError: pass
        raise


def _load(path: Path, default):
    if not path.exists():
        return default
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"corrupt snapshot {path}: {e}")


# ---------------------------- word English ----------------------------
# Shape: { "<word_id>": "<english gloss>" }
WORD_ENGLISH = DERIVED / "word_english.json"

def load_word_english() -> dict[str, str]:
    return _load(WORD_ENGLISH, {})

def save_word_english(data: dict[str, str]) -> None:
    _atomic_write_json(WORD_ENGLISH, data)


# ---------------------------- word → activities ----------------------------
# Shape: { "<word_id>": { "<activity_id>": <relevance 1-3>, ... } }
WORD_ACTIVITIES = DERIVED / "word_activities.json"

def load_word_activities() -> dict[str, dict[str, int]]:
    raw = _load(WORD_ACTIVITIES, {})
    return {k: {aid: int(r) for aid, r in v.items()} for k, v in raw.items()}

def save_word_activities(data: dict[str, dict[str, int]]) -> None:
    _atomic_write_json(WORD_ACTIVITIES, data)


# ---------------------------- word → associated words ----------------------------
# Shape: { "<word_id>": [ "<related word_id>", ... ] }   ([] = decided: none)
WORD_ASSOCIATIONS = DERIVED / "word_associations.json"

def load_word_associations() -> dict[str, list[str]]:
    return _load(WORD_ASSOCIATIONS, {})

def save_word_associations(data: dict[str, list[str]]) -> None:
    _atomic_write_json(WORD_ASSOCIATIONS, data)


# ---------------------------- Goethe sentence → activity ----------------------------
# Shape: [ [word_id, text, activity_id_or_null], ... ]
# We key by (word_id, text) because sentence.id is a build-time autoincrement.
SENTENCE_ACTIVITIES = DERIVED / "sentence_activities.json"

def load_sentence_activities() -> dict[tuple[str, str], str | None]:
    raw = _load(SENTENCE_ACTIVITIES, [])
    return {(w, t): a for w, t, a in raw}

def save_sentence_activities(data: dict[tuple[str, str], str | None]) -> None:
    serializable = sorted(
        ([w, t, a] for (w, t), a in data.items()),
        key=lambda row: (row[0], row[1]),
    )
    _atomic_write_json(SENTENCE_ACTIVITIES, serializable)


# ---------------------------- sentence → English ----------------------------
# Shape: [ [word_id, text, english], ... ]
# Same keying rationale as above.
SENTENCE_ENGLISH = DERIVED / "sentence_english.json"

def load_sentence_english() -> dict[tuple[str, str], str]:
    raw = _load(SENTENCE_ENGLISH, [])
    return {(w, t): e for w, t, e in raw}

def save_sentence_english(data: dict[tuple[str, str], str]) -> None:
    serializable = sorted(
        ([w, t, e] for (w, t), e in data.items()),
        key=lambda row: (row[0], row[1]),
    )
    _atomic_write_json(SENTENCE_ENGLISH, serializable)


# ---------------------------- generated (word × activity) sentences ----------------------------
# Shape: [ {word_id, activity_id (or null for core), de, en}, ... ]
# Keyed by (word_id, activity_id) uniqueness — one LLM-generated sentence per pair.
GENERATED_SENTENCES = DERIVED / "generated_sentences.json"

def load_generated_sentences() -> dict[tuple[str, str | None], dict]:
    raw = _load(GENERATED_SENTENCES, [])
    return {(r["word_id"], r.get("activity_id")): r for r in raw}

def save_generated_sentences(data: dict[tuple[str, str | None], dict]) -> None:
    serializable = sorted(
        data.values(),
        key=lambda r: (r["word_id"], r.get("activity_id") or ""),
    )
    _atomic_write_json(GENERATED_SENTENCES, serializable)
