"""Push the freshly built content DB into every learner profile.

Profiles (data/profiles/<slug>.sqlite) start as a copy of data/vocab.sqlite,
so without this step a rebuild never reaches the app. For each profile we
replace the content tables (words, activities, word_activities, sentences)
and keep all learner state (swipes, SRS, known words, ...).

Sentence ids are autoincrement and can change between builds, so swipes are
re-pointed by (word_id, text) rather than by id. A copy of each profile is
saved to data/profiles/.backup/ before it is touched.

    python -m pipeline.publish
"""

from __future__ import annotations

import shutil
import sqlite3
from contextlib import closing
from pathlib import Path

from .db import ROOT, connect, db_path, ensure_schema

PROFILES_DIR = ROOT / "data" / "profiles"
BACKUP_DIR = PROFILES_DIR / ".backup"

# Learner tables that reference words(id); words they use are never deleted.
_WORD_REFS = ("swipes", "known_words", "flashcard_learned", "word_srs", "reviews")


def _sync(conn: sqlite3.Connection, template: Path) -> None:
    conn.execute("PRAGMA foreign_keys = OFF")
    conn.execute("ATTACH DATABASE ? AS tpl", (str(template),))
    try:
        conn.executescript(
            """
            BEGIN;
            INSERT INTO activities (id, name, description)
              SELECT id, name, description FROM tpl.activities WHERE true
              ON CONFLICT(id) DO UPDATE SET name = excluded.name,
                                            description = excluded.description;

            INSERT INTO words (id, lemma, article, plural, pos, english, level)
              SELECT id, lemma, article, plural, pos, english, level FROM tpl.words WHERE true
              ON CONFLICT(id) DO UPDATE SET lemma = excluded.lemma, article = excluded.article,
                plural = excluded.plural, pos = excluded.pos,
                english = excluded.english, level = excluded.level;

            DELETE FROM word_activities;
            INSERT INTO word_activities SELECT * FROM tpl.word_activities;

            UPDATE swipes SET sentence_id = (
              SELECT t.id FROM sentences s
              JOIN tpl.sentences t ON t.word_id = s.word_id AND t.text = s.text
              WHERE s.id = swipes.sentence_id
              LIMIT 1
            ) WHERE sentence_id IS NOT NULL;

            DELETE FROM sentences;
            INSERT INTO sentences SELECT * FROM tpl.sentences;
            COMMIT;
            """
        )
        refs = " AND ".join(f"id NOT IN (SELECT word_id FROM {t})" for t in _WORD_REFS)
        conn.execute(f"DELETE FROM words WHERE id NOT IN (SELECT id FROM tpl.words) AND {refs}")
        conn.commit()
    finally:
        conn.execute("DETACH DATABASE tpl")
        conn.execute("PRAGMA foreign_keys = ON")


def run() -> int:
    template = db_path()
    profiles = sorted(PROFILES_DIR.glob("*.sqlite")) if PROFILES_DIR.exists() else []
    if not profiles:
        print("  no profiles yet (new profiles copy the content DB on creation)")
        return 0
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for p in profiles:
        with closing(connect(p)) as conn:
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            shutil.copy(p, BACKUP_DIR / p.name)
            ensure_schema(conn)
            _sync(conn, template)
            n = conn.execute("SELECT COUNT(*) FROM sentences").fetchone()[0]
        print(f"  {p.stem}: {n} sentences")
    return len(profiles)


if __name__ == "__main__":
    print(f"published to {run()} profiles")
