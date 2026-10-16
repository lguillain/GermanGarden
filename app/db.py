"""App-side DB access. Each learner has their own SQLite file under
`data/profiles/<slug>.sqlite`, cloned from the pipeline-built content DB
on first use. The active profile is tracked via a cookie."""

from __future__ import annotations

import re
import shutil
import sqlite3
from contextlib import closing, contextmanager
from pathlib import Path

from fastapi import Request

from pipeline.db import ROOT, connect, db_path, ensure_schema

PROFILES_DIR = ROOT / "data" / "profiles"
COOKIE = "profile"


class RequiresProfile(Exception):
    """Raised by request_db when the current request has no valid profile
    cookie. The app's exception handler redirects to /profile."""


def _migrate_user_state(conn: sqlite3.Connection) -> None:
    """Non-destructive ADD COLUMN migrations. Covers user_state and swipes;
    schema.sql's CREATE IF NOT EXISTS handles brand-new tables (word_srs,
    reviews, sessions)."""
    existing = {r["name"] for r in conn.execute("PRAGMA table_info(user_state)")}
    for col, ddl in [
        ("name",            "TEXT"),
        ("current_topic",   "TEXT"),
        ("cards_in_bucket", "INTEGER NOT NULL DEFAULT 0"),
        ("affinity_below",  "REAL NOT NULL DEFAULT 1.0"),
        ("affinity_above",  "REAL NOT NULL DEFAULT 1.0"),
    ]:
        if col not in existing:
            conn.execute(f"ALTER TABLE user_state ADD COLUMN {col} {ddl}")

    swipe_cols = {r["name"] for r in conn.execute("PRAGMA table_info(swipes)")}
    if "planted_at" not in swipe_cols:
        conn.execute("ALTER TABLE swipes ADD COLUMN planted_at TEXT")
    conn.commit()


# ---------------------------- profiles ----------------------------


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return s[:40] or "user"


def profile_path(slug: str) -> Path:
    return PROFILES_DIR / f"{slug}.sqlite"


def list_profiles() -> list[dict]:
    """[{slug, name}] for every profile DB on disk. Falls back to the slug
    if the DB's user_state has no name yet."""
    if not PROFILES_DIR.exists():
        return []
    out: list[dict] = []
    for f in sorted(PROFILES_DIR.glob("*.sqlite")):
        slug = f.stem
        name = slug
        try:
            with closing(sqlite3.connect(f)) as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT name FROM user_state WHERE id = 1"
                ).fetchone()
                if row and row["name"]:
                    name = row["name"]
        except sqlite3.Error:
            pass
        out.append({"slug": slug, "name": name})
    return out


def _bootstrap_default() -> None:
    """One-time: if someone had progress in the pre-multi-profile DB and no
    profile files exist yet, adopt it as a 'default' profile so we don't
    lose their state."""
    if PROFILES_DIR.exists() and any(PROFILES_DIR.glob("*.sqlite")):
        return
    main = db_path()
    if not main.exists():
        return
    try:
        with closing(connect(main)) as conn:
            ensure_schema(conn); _migrate_user_state(conn)
            swipes = conn.execute("SELECT COUNT(*) FROM swipes").fetchone()[0]
    except sqlite3.Error:
        return
    if swipes == 0:
        return
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    dest = profile_path("default")
    shutil.copy(main, dest)
    with closing(connect(dest)) as conn:
        conn.execute(
            "UPDATE user_state SET name = COALESCE(name, 'Default') WHERE id = 1"
        )
        conn.commit()
    # Clear runtime state in the main DB so it serves as a clean content template.
    with closing(connect(main)) as conn:
        conn.executescript(
            "DELETE FROM swipes; DELETE FROM known_words; "
            "DELETE FROM activity_weights; DELETE FROM user_state; "
            "DELETE FROM flashcard_learned; DELETE FROM word_srs; "
            "DELETE FROM reviews; DELETE FROM sessions;"
        )
        conn.commit()


def create_profile(name: str) -> str:
    """Create (or select, if already present) a profile from the pipeline-
    built content template. Returns the slug."""
    name = name.strip()
    if not name:
        raise ValueError("name required")
    slug = _slugify(name)
    dest = profile_path(slug)
    if dest.exists():
        return slug
    template = db_path()
    if not template.exists():
        raise RuntimeError(
            f"content DB missing at {template} — run the pipeline first"
        )
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy(template, dest)
    with closing(connect(dest)) as conn:
        ensure_schema(conn); _migrate_user_state(conn)
        conn.executescript(
            "DELETE FROM swipes; DELETE FROM known_words; "
            "DELETE FROM activity_weights; DELETE FROM user_state; "
            "DELETE FROM flashcard_learned; DELETE FROM word_srs; "
            "DELETE FROM reviews; DELETE FROM sessions;"
        )
        conn.execute(
            "INSERT INTO user_state (id, name) VALUES (1, ?)", (name,),
        )
        conn.commit()
    return slug


# ---------------------------- request-scoped DB ----------------------------


def _resolve_profile(request: Request) -> Path:
    _bootstrap_default()
    slug = request.cookies.get(COOKIE, "")
    if not slug or not re.fullmatch(r"[a-z0-9_]{1,40}", slug):
        raise RequiresProfile()
    path = profile_path(slug)
    if not path.exists():
        raise RequiresProfile()
    return path


@contextmanager
def open_app_db(slug: str):
    """Non-request path (e.g. background tasks). Caller supplies the slug."""
    path = profile_path(slug)
    conn = connect(path)
    try:
        ensure_schema(conn); _migrate_user_state(conn)
        yield conn
        conn.commit()
    finally:
        conn.close()


def request_db(request: Request):
    """FastAPI dependency: one profile connection per request. Raises
    RequiresProfile when no valid profile cookie is set."""
    path = _resolve_profile(request)
    # FastAPI can run dependency setup, the endpoint, and cleanup on different
    # worker threads. Each request still owns its own connection exclusively.
    conn = connect(path, check_same_thread=False)
    try:
        ensure_schema(conn)
        _migrate_user_state(conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
