import json
import sqlite3
import unittest
from datetime import datetime

from app.garden import reviews_due_today, upcoming_reviews, words_found_today
from pipeline.db import ensure_schema


class ReviewsDueTodayTests(unittest.TestCase):
    def test_tracks_exclusions_and_local_midnight(self):
        with sqlite3.connect(':memory:') as conn:
            conn.row_factory = sqlite3.Row
            ensure_schema(conn)
            for i in range(8):
                word = f'word-{i}'
                conn.execute("INSERT INTO words(id,lemma,pos,english,level) VALUES (?,?,'noun','word','A2')", (word, word))
                conn.execute("INSERT INTO swipes(word_id,action,planted_at) VALUES (?,'keep','2026-10-01')", (word,))
                conn.execute("INSERT INTO word_srs(word_id,due_at) VALUES (?,'2026-10-26 12:00:00')", (word,))
            for i, due in [(0, '2026-10-24 10:00:00'), (1, '2026-10-25 22:59:59'), (3, '2026-10-25 23:00:00'), (4, '2026-10-25 12:00:00'), (5, '2026-10-25 12:00:00'), (6, '2026-10-25 12:00:00')]:
                conn.execute('UPDATE word_srs SET due_at=? WHERE word_id=?', (due, f'word-{i}'))
            for i in [1, 2]:
                conn.execute('UPDATE word_srs SET production=? WHERE word_id=?', (json.dumps({'due_at': '2026-10-25T20:00:00Z'}), f'word-{i}'))
            conn.execute("INSERT INTO known_words(word_id) VALUES ('word-4')")
            conn.execute("INSERT INTO flashcard_learned(word_id) VALUES ('word-5')")
            conn.execute("UPDATE swipes SET planted_at=NULL WHERE word_id='word-6'")
            conn.execute("DELETE FROM word_srs WHERE word_id='word-7'")
            now = datetime.fromisoformat('2026-10-25T12:00:00+00:00')
            self.assertEqual(reviews_due_today(conn, 'Europe/Zurich', now), 4)
            self.assertEqual(reviews_due_today(conn, 'UTC', now), 5)
            self.assertEqual(upcoming_reviews(conn, 'Europe/Zurich', now), [
                {"date": "2026-10-25", "count": 2},
                {"date": "2026-10-26", "count": 1},
            ])

    def test_words_found_today_uses_first_keep_and_local_date(self):
        with sqlite3.connect(':memory:') as conn:
            conn.row_factory = sqlite3.Row
            ensure_schema(conn)
            for i in range(5):
                conn.execute("INSERT INTO words(id,lemma,pos,english,level) VALUES (?,?,'noun','word','A2')", (f'word-{i}', f'word-{i}'))
            for word, action, timestamp in [
                ('word-0', 'keep', '2026-10-24 22:30:00'),
                ('word-1', 'keep', '2026-10-24 21:30:00'),
                ('word-2', 'keep', '2026-10-25 10:00:00'),
                ('word-1', 'keep', '2026-10-25 11:00:00'),
                ('word-3', 'drop', '2026-10-25 11:00:00'),
            ]:
                conn.execute('INSERT INTO swipes(word_id,action,swiped_at) VALUES (?,?,?)', (word, action, timestamp))
            conn.execute("UPDATE swipes SET planted_at='2026-10-25' WHERE word_id='word-2'")
            conn.execute("INSERT INTO flashcard_learned(word_id) VALUES ('word-2')")
            conn.execute("INSERT INTO known_words(word_id) VALUES ('word-4')")
            now = datetime.fromisoformat('2026-10-25T12:00:00+00:00')
            self.assertEqual(words_found_today(conn, 'Europe/Zurich', now), 2)
            self.assertEqual(words_found_today(conn, 'UTC', now), 1)
