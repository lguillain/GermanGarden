"""SQLite helpers: open the DB, load schema, give the app a connection."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = ROOT / "schema.sql"
DEFAULT_DB = ROOT / "data" / "vocab.sqlite"


def db_path() -> Path:
    return Path(os.environ.get("DB_PATH", DEFAULT_DB))


def connect(path: Path | None = None, *, check_same_thread: bool = True) -> sqlite3.Connection:
    p = Path(path) if path else db_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(p, check_same_thread=check_same_thread)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    conn.execute("DROP TABLE IF EXISTS sessions")
    conn.commit()


@contextmanager
def session(path: Path | None = None):
    conn = connect(path)
    try:
        ensure_schema(conn)
        yield conn
        conn.commit()
    finally:
        conn.close()
