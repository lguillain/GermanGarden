import sqlite3
import unittest
from pathlib import Path
from pipeline.merge_geburtsjahr import run, OLD, NEW


class MergeGeburtsjahrTests(unittest.TestCase):
    def database(self):
        conn = sqlite3.connect(':memory:')
        conn.executescript(Path('schema.sql').read_text())
        conn.execute('PRAGMA foreign_keys=ON')
        conn.executemany('INSERT INTO words(id,lemma,pos,level,english) VALUES (?,?,?,?,?)',
                         [(OLD, 'Geburts-(jahr', 'other', 'A2', 'birth year'), (NEW, 'Geburtsjahr', 'noun', 'A2', 'birth year')])
        return conn

    def test_offline_merge_is_idempotent(self):
        with self.database() as conn:
            conn.execute("INSERT INTO activities(id,name) VALUES ('test','Test')")
            conn.executemany('INSERT INTO word_activities VALUES (?,?,?)', [(OLD,'test',3),(NEW,'test',1)])
            self.assertEqual(run(conn), 1)
            self.assertEqual(run(conn), 0)
            self.assertEqual(conn.execute('SELECT word_id,relevance FROM word_activities').fetchall(), [(NEW,3)])
            self.assertEqual(conn.execute('SELECT id FROM words').fetchall(), [(NEW,)])

    def test_legacy_progress_blocks_offline_deletion(self):
        with self.database() as conn:
            conn.execute('INSERT INTO known_words(word_id) VALUES (?)', (OLD,))
            with self.assertRaisesRegex(ValueError, 'Import legacy learner progress'):
                run(conn)
            self.assertIsNotNone(conn.execute('SELECT id FROM words WHERE id=?', (OLD,)).fetchone())
