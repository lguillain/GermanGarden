"""Load activities.yaml into DB; tag each word with the activities it fits.

Tagging is batched: ~40 words per LLM call. The LLM returns, for each word,
an object mapping activity_id → relevance (1-3). Words with an empty object
are "core": they get no word_activities rows, and the empty mapping is kept
in the snapshot (data/derived/word_activities.json) so they're never re-sent.

    python -m pipeline.activities [--limit N]
"""

from __future__ import annotations

import sqlite3

import yaml

from . import snapshots
from .db import ROOT
from .llm import MODEL_BULK, Prompt
from .steps import cli, indexed, numbered, restore, run_batches

ACTIVITIES_YAML = ROOT / "activities.yaml"
BATCH = 40


def load_activities(conn: sqlite3.Connection) -> int:
    data = yaml.safe_load(ACTIVITIES_YAML.read_text(encoding="utf-8")) or []
    for a in data:
        conn.execute(
            """
            INSERT INTO activities (id, name, description)
            VALUES (:id, :name, :description)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description
            """,
            {"id": a["id"], "name": a["name"], "description": a.get("description", "")},
        )
    conn.commit()
    return len(data)


def _system(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT id, name, description FROM activities ORDER BY id").fetchall()
    activity_lines = "\n".join(f"- {r['id']}: {r['name']} — {r['description']}" for r in rows)
    return (
        "You tag German vocabulary with the everyday activities each word is "
        "most useful for. Activities:\n\n"
        f"{activity_lines}\n\n"
        "Relevance scale:\n"
        "  3 = central vocabulary for this activity (you'd use it most times you do it)\n"
        "  2 = commonly comes up in this activity\n"
        "  1 = occasionally relevant\n\n"
        "Many words fit no activity at all — these are grammar words, generic "
        "verbs, or everyday fillers (weil, schon, machen, Sache). Return an "
        "empty object for them.\n\n"
        'Reply with STRICT JSON: {"<row number>": {"<activity_id>": <relevance>, ...}, ...}. '
        "Only use the activity_ids above. No prose, no markdown."
    )


def _clean(mapping: dict, activity_ids: set[str]) -> dict[str, int]:
    """Keep known activity ids, relevance clamped to 1-3."""
    out = {}
    for act_id, rel in mapping.items():
        if act_id not in activity_ids:
            continue
        try:
            out[act_id] = max(1, min(3, int(rel)))
        except (TypeError, ValueError):
            continue
    return out


def run(conn: sqlite3.Connection, limit: int | None = None) -> int:
    activity_ids = {r[0] for r in conn.execute("SELECT id FROM activities")}
    cache = snapshots.load_word_activities()
    restored = restore(
        conn,
        "INSERT OR IGNORE INTO word_activities (word_id, activity_id, relevance) VALUES (?, ?, ?)",
        ((wid, aid, rel) for wid, tags in cache.items()
         for aid, rel in _clean(tags, activity_ids).items()),
    )
    if restored:
        print(f"  restored {restored} tags from snapshot")

    # Anything in the snapshot (tagged or explicitly core) or already tagged
    # in the DB has been decided; only the rest goes to the LLM.
    decided = set(cache) | {r[0] for r in conn.execute("SELECT DISTINCT word_id FROM word_activities")}
    pending = [w for w in conn.execute("SELECT id, lemma, pos, english FROM words ORDER BY level, id")
               if w["id"] not in decided][:limit]

    system = _system(conn)

    def prompt(batch):
        return Prompt(
            system=system,
            user="Tag these words:\n\n"
                 + numbered(batch, lambda w: f"{w['lemma']} ({w['pos']}, {w['english']})"),
            model=MODEL_BULK, max_tokens=4000, temperature=0.2,
        )

    def apply(batch, data):
        n = 0
        for w, mapping in indexed(data, batch):
            if not isinstance(mapping, dict):
                continue
            cache[w["id"]] = tags = _clean(mapping, activity_ids)   # {} → core
            for act_id, rel in tags.items():
                conn.execute(
                    "INSERT INTO word_activities (word_id, activity_id, relevance) VALUES (?, ?, ?) "
                    "ON CONFLICT DO UPDATE SET relevance = excluded.relevance",
                    (w["id"], act_id, rel),
                )
                n += 1
        return n

    return run_batches(conn, "tag words", pending, BATCH, prompt, apply,
                       lambda: snapshots.save_word_activities(cache))


def _main(conn: sqlite3.Connection, limit: int | None = None) -> int:
    print(f"  loaded {load_activities(conn)} activities")
    return run(conn, limit)


if __name__ == "__main__":
    cli(_main, "(word, activity) tags via LLM")
