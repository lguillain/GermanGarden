import unittest
import sqlite3
from unittest.mock import patch
from pipeline.goethe_json import parse_headword
from pipeline import noun_forms

class NounFormsTests(unittest.TestCase):
    def test_unchanged_and_umlaut_plurals(self):
        for headword, plural in [('der Lehrer, -', 'Lehrer'), ('der Bruder, -ü', 'Brüder'), ('die Mutter, -ü', 'Mütter'), ('der Laden, -ä', 'Läden'), ('das Haus, -ä, er', 'Häuser'), ('der Baum, -ä, e', 'Bäume'), ('die Lehrerin, -nen', 'Lehrerinnen')]:
            with self.subTest(headword=headword):
                self.assertEqual(parse_headword(headword, 'A1')[0]['plural'], plural)

    def test_contracted_plural_suffixes(self):
        for headword, plural in [('die Adresse, -en', 'Adressen'), ('die Firma, -en', 'Firmen'), ('das Datum, -en', 'Daten'), ('das Konto, -en', 'Konten')]:
            with self.subTest(headword=headword):
                self.assertEqual(parse_headword(headword, 'A1')[0]['plural'], plural)

    def test_incomplete_compound_is_not_imported_as_a_word(self):
        self.assertEqual(parse_headword('Geburts-(jahr, ort)', 'A1'), [])

    def test_restore_preserves_source_article_and_plural_and_repairs_legacy_id(self):
        with sqlite3.connect(':memory:') as conn:
            conn.row_factory = sqlite3.Row
            conn.execute('create table words (id text primary key, lemma text, pos text, article text, plural text, english text)')
            conn.executemany('insert into words values (?,?,?,?,?,?)', [
                ('noun_teil', 'Teil', 'noun', 'der', 'Teile', 'part'),
                ('other_geburts_jahr', 'Geburts-(jahr', 'other', None, None, 'birth year'),
            ])
            with patch.object(noun_forms.snapshots, 'load_noun_forms', return_value={
                'noun_teil': {'article': 'das', 'plural': None},
            }), patch.object(noun_forms.snapshots, 'save_noun_forms'), patch.object(noun_forms, 'complete') as complete:
                noun_forms.run(conn)
                complete.assert_not_called()
            self.assertEqual(tuple(conn.execute("select article,plural from words where id='noun_teil'").fetchone()), ('der', 'Teile'))
            self.assertEqual(tuple(conn.execute("select lemma,pos,article,plural from words where id='other_geburts_jahr'").fetchone()), ('Geburtsjahr', 'noun', 'das', 'Geburtsjahre'))
