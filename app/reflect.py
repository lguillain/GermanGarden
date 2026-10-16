"""LLM-driven next-topic picker.

Called by the feed whenever it auto-switches buckets. Looks at the
learner's recent kept words, asks the LLM to pick the best-fitting
activity from the shortlist of topics that still have unseen at-level
material, and returns that activity_id.

Returns None (and the feed falls back to its deterministic rotation
picker) when: the LLM isn't configured, we don't have enough keeps yet
to form a signal, the shortlist is empty, or the LLM reply is invalid.
"""

from __future__ import annotations

import sqlite3

from pipeline.llm import (
    LLMUnavailable, MODEL_WRITE, Prompt, available, complete, extract_json,
)

MIN_KEEPS = 5         # below this, no signal — fall back to rotation
KEEPS_WINDOW = 40     # look at the last N kept words

SYSTEM = (
    "A learner is swiping through German vocab grouped by activity (topic). "
    "You will see the words they recently KEPT (and which activity each came "
    "from), plus a shortlist of candidate activities with descriptions. "
    "Pick the ONE activity id from the shortlist whose theme best matches "
    "what the learner has been keeping. If no candidate is a strong match, "
    "pick the one closest in theme.\n\n"
    'Reply with STRICT JSON: {"activity_id": "<id>"}. The id MUST be one '
    "from the shortlist. No prose."
)


def _recent_keeps(conn: sqlite3.Connection, limit: int) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT w.lemma, w.english, s.activity_id
        FROM swipes s
        JOIN words w ON w.id = s.word_id
        WHERE s.action = 'keep'
        ORDER BY s.id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()


def _candidates(
    conn: sqlite3.Connection, level: str, exclude: str | None,
) -> list[sqlite3.Row]:
    """Activities with at least one unseen at-level word — the same set the
    deterministic picker would consider."""
    args: list = [level]
    extra = ""
    if exclude:
        extra = " AND a.id != ?"
        args.append(exclude)
    return conn.execute(
        f"""
        SELECT a.id, a.name, a.description
        FROM activities a
        WHERE EXISTS (
          SELECT 1 FROM word_activities wa
          JOIN words w ON w.id = wa.word_id
          WHERE wa.activity_id = a.id
            AND w.level = ?
            AND w.id NOT IN (SELECT word_id FROM swipes)
            AND w.id NOT IN (SELECT word_id FROM known_words)
        ){extra}
        ORDER BY a.id
        """,
        args,
    ).fetchall()


def recommend_next_topic(
    conn: sqlite3.Connection, level: str, exclude: str | None = None,
) -> str | None:
    if not available():
        return None
    keeps = _recent_keeps(conn, KEEPS_WINDOW)
    if len(keeps) < MIN_KEEPS:
        return None
    candidates = _candidates(conn, level, exclude)
    if not candidates:
        return None

    keep_lines = "\n".join(
        f"- {r['lemma']} ({r['english']}) — from {r['activity_id'] or 'core'}"
        for r in keeps
    )
    candidate_lines = "\n".join(
        f"- {r['id']}: {r['name']} — {r['description']}" for r in candidates
    )
    try:
        out = complete(
            Prompt(
                system=SYSTEM + "\n\nShortlist:\n" + candidate_lines,
                user="Recent keeps:\n" + keep_lines,
                model=MODEL_WRITE,
                max_tokens=120,
                temperature=0.2,
            )
        )
        data = extract_json(out)
    except LLMUnavailable:
        return None
    except Exception as e:
        print(f"reflect: {e}")
        return None

    valid = {r["id"] for r in candidates}
    picked = data.get("activity_id") if isinstance(data, dict) else None
    return picked if picked in valid else None
