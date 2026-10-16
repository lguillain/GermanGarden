"""Onboarding: free-text about the user's German goals -> activity weights.

Also exposed as "re-steer" during the session: same endpoint can be called
mid-session to update weights without resetting the user.
"""

from __future__ import annotations

import sqlite3

from pipeline.llm import MODEL_WRITE, LLMUnavailable, Prompt, available, complete, extract_json

from .feed import seed_activity_weights, set_weights


SYSTEM = (
    "You take a short free-text description of what someone does in German and "
    "which situations trip them up, and translate it into activity weights.\n\n"
    "You will be given a list of activity IDs with short descriptions. Assign "
    "each a weight between 0.3 and 3.0 based on how central it is to what the "
    "user described. If the user mentions a situation that doesn't match any "
    "activity, ignore it (don't invent new IDs).\n\n"
    "Default is 1.0. Mentioned-and-emphasized: 2.0–3.0. Mentioned-briefly: "
    "1.3–1.8. Explicitly dismissed: 0.3–0.5. Everything else: 1.0.\n\n"
    'Reply with STRICT JSON: {"<activity_id>": <weight>, ...}. All activity '
    "ids must appear. No prose."
)


def steer(conn: sqlite3.Connection, free_text: str) -> dict[str, float]:
    seed_activity_weights(conn)
    rows = conn.execute("SELECT id, name, description FROM activities ORDER BY id").fetchall()
    if not rows or not available():
        # No key — leave weights at their current (default) values. The feed
        # still works; it just won't personalize to the user's text.
        return {r["id"]: 1.0 for r in rows}
    activity_lines = "\n".join(f"- {r['id']}: {r['name']} — {r['description']}" for r in rows)

    try:
        out = complete(
            Prompt(
                system=SYSTEM + "\n\nActivities:\n" + activity_lines,
                user=f"User wrote:\n\n{free_text.strip()}",
                model=MODEL_WRITE,
                max_tokens=1000,
                temperature=0.3,
            )
        )
        data = extract_json(out)
    except LLMUnavailable:
        return {r["id"]: 1.0 for r in rows}
    valid = {r["id"] for r in rows}
    weights = {
        aid: max(0.3, min(3.0, float(w)))
        for aid, w in data.items()
        if aid in valid and isinstance(w, (int, float))
    }
    # Fill in defaults for any missing activity.
    for r in rows:
        weights.setdefault(r["id"], 1.0)
    set_weights(conn, weights)
    return weights


def set_level(conn: sqlite3.Connection, level: str | None) -> None:
    if level not in ("A1", "A2", "B1", None):
        return
    conn.execute("INSERT OR IGNORE INTO user_state (id) VALUES (1)")
    conn.execute(
        "UPDATE user_state SET level = ?, updated_at = datetime('now') WHERE id = 1",
        (level,),
    )
    conn.commit()
