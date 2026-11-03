import sqlite3
import unittest
from pathlib import Path
from pipeline.goethe_json import parse_headword
from pipeline.non_noun_repairs import run


class NonNounRepairsTests(unittest.TestCase):
    def test_grouped_verb_import_uses_distinct_entries(self):
        for source in ('verbieten /verboten sein', 'verbieten/verboten sein', 'verbieten / verboten sein'):
            self.assertEqual([(w['lemma'], w['pos']) for w in parse_headword(source, 'A2')], [('verboten sein', 'verb'), ('verbieten', 'verb')])
        self.assertEqual([w['lemma'] for w in parse_headword('in Rente gehen/sein', 'B1')], ['in Rente gehen', 'in Rente sein'])

    def test_non_verbs_are_not_classified_by_en_suffix(self):
        for lemma, pos in [('draußen', 'adv'), ('verboten', 'adj'), ('zwischen', 'prep')]:
            self.assertEqual(parse_headword(lemma, 'A2')[0]['pos'], pos)
        self.assertEqual(parse_headword('(sich) waschen', 'A2')[0]['lemma'], '(sich) waschen')
        self.assertEqual(len(parse_headword('gern/gerne', 'A2')), 1)

    def test_split_additions_start_without_copied_marks(self):
        with sqlite3.connect(':memory:') as conn:
            conn.executescript(Path('schema.sql').read_text())
            conn.execute("INSERT INTO words(id,lemma,pos,english,level) VALUES ('verb_dafur_dagegen_sein','dafür/dagegen sein','verb','to be for / against','A2')")
            conn.execute("INSERT INTO known_words(word_id) VALUES ('verb_dafur_dagegen_sein')")
            run(conn)
            run(conn)
            self.assertEqual(conn.execute("SELECT lemma FROM words WHERE id='verb_dagegen_sein'").fetchone()[0], 'dagegen sein')
            self.assertEqual(conn.execute('SELECT word_id FROM known_words').fetchall(), [('verb_dafur_dagegen_sein',)])
