import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pipeline.db import session
from pipeline.verb_objects import clean, run
import runpy


class VerbObjectTests(unittest.TestCase):
    def test_direct_object_format_rejects_prepositional_phrases(self):
        self.assertEqual(clean('einen Vertrag unterschreiben'), 'einen Vertrag unterschreiben')
        self.assertEqual(clean('Geld sparen'), 'Geld sparen')
        self.assertIsNone(clean('in der Prüfung abschreiben'))
        self.assertIsNone(clean('mit dem Mieter sprechen'))
        self.assertIsNone(clean(None))

    def test_restore_accepts_only_explicit_phrases_and_preserves_rejections(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp)/'vocab.sqlite'
            with session(db) as conn:
                for wid, lemma, pos in [('rent', 'vermieten', 'verb'), ('flat', 'Wohnung', 'noun'), ('contract', 'Vertrag', 'noun')]:
                    conn.execute('INSERT INTO words (id,lemma,pos,english,level) VALUES (?,?,?,?,?)', (wid,lemma,pos,lemma,'A2'))
                cache = {'rent|flat': 'eine Wohnung vermieten', 'rent|contract': None}
                with patch('pipeline.verb_objects.snapshots.load_verb_objects', return_value=cache), patch('pipeline.verb_objects.snapshots.save_verb_objects'), patch('pipeline.verb_objects.complete', side_effect=AssertionError('No AI on restore')):
                    run(conn)
                self.assertEqual([tuple(r) for r in conn.execute('SELECT * FROM verb_objects')], [('rent','flat','eine Wohnung vermieten')])
            sql = runpy.run_path('scripts/verb-objects-migration.py')['migration'](db)
            self.assertIn('eine Wohnung vermieten', sql)
            self.assertNotIn('contract', sql)
            self.assertNotIn('learner', sql)
