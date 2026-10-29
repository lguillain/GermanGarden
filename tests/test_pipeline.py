"""Verify vocabulary creation and export using disposable datasets, without AI."""
import os
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pipeline import seed
from pipeline.db import session


class DatasetTests(unittest.TestCase):
    def test_associations_keep_only_known_distinct_words(self):
        from pipeline.associations import _clean
        known = {'zug', 'gleis', 'bahnhof', 'fahrkarte', 'post', 'brief', 'hotel'}
        self.assertEqual(_clean('zug', ['gleis', 'zug', 'gleis', 'erfunden', 3, 'bahnhof'], known), ['gleis', 'bahnhof'])
        self.assertEqual(len(_clean('zug', sorted(known), known)), 6)
        self.assertEqual(_clean('zug', 'gleis', known), [])


    def test_sample_rebuild_and_export_preserve_dataset(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'vocab.sqlite'
            with patch.dict(os.environ, {'DB_PATH': str(path)}):
                first = seed.load()
                self.assertGreater(first['words'], 0)
                self.assertEqual(seed.load(), first)
                with session() as conn:
                    self.assertEqual(conn.execute('PRAGMA foreign_key_check').fetchall(), [])
                    self.assertEqual(conn.execute('SELECT count(*) FROM words').fetchone()[0], first['words'])
                    self.assertGreater(conn.execute('SELECT count(*) FROM sentences').fetchone()[0], 0)
                with session() as conn:
                    first_id, second_id = [r[0] for r in conn.execute('SELECT id FROM words LIMIT 2')]
                    conn.execute('INSERT INTO word_associations VALUES (?, ?, 1)', (first_id, second_id))
                    conn.commit()
                before = path.read_bytes()
                exporter = runpy.run_path('scripts/export-supabase.py')
                sql = exporter['export'](path)
                self.assertIn('INSERT INTO public.words', sql)
                self.assertIn('INSERT INTO public.word_associations', sql)
                self.assertNotIn('import_learner_progress', sql)
                self.assertTrue(sql.startswith('BEGIN;'))
                self.assertTrue(sql.endswith('COMMIT;\n'))
                self.assertEqual(path.read_bytes(), before)
