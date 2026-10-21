import sqlite3
import unittest

from pipeline.db import ensure_schema


class RemoveTimeTrackingTests(unittest.TestCase):
    def test_existing_time_history_is_removed_and_progress_preserved(self):
        with sqlite3.connect(':memory:') as conn:
            ensure_schema(conn)
            conn.execute("INSERT INTO user_state(id,name,level) VALUES (1,'Test','A2')")
            conn.execute("CREATE TABLE sessions(seconds INTEGER)")
            conn.execute("INSERT INTO sessions VALUES (42)")
            ensure_schema(conn)
            self.assertEqual(conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
            ).fetchall(), [])
            self.assertEqual(conn.execute(
                "SELECT name,level FROM user_state"
            ).fetchone(), ('Test', 'A2'))
            ensure_schema(conn)
