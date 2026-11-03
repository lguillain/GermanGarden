import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('noun corrections preserve word IDs, references and progress on repeated application', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table words (id text primary key, lemma text, pos text, article text, plural text);
      insert into words values ('other_geburts_jahr','Geburts-(jahr','other',null,null),
        ('noun_haus','Haus','noun','das','Haüser'), ('noun_lehrer','Lehrer','noun','der',null),
        ('verb_spielen','spielen','verb',null,null);
      create table progress (word_id text references words(id), stage integer);
      insert into progress values ('other_geburts_jahr',3),('noun_haus',5);`);
    const migration = readFileSync('supabase/migrations/202611030001_noun_forms_data.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual((await db.query('select * from words order by id')).rows, [
      { id: 'noun_haus', lemma: 'Haus', pos: 'noun', article: 'das', plural: 'Häuser' },
      { id: 'noun_lehrer', lemma: 'Lehrer', pos: 'noun', article: 'der', plural: 'Lehrer' },
      { id: 'other_geburts_jahr', lemma: 'Geburtsjahr', pos: 'noun', article: 'das', plural: 'Geburtsjahre' },
      { id: 'verb_spielen', lemma: 'spielen', pos: 'verb', article: null, plural: null },
    ]);
    assert.deepEqual((await db.query('select * from progress order by word_id')).rows, [
      { word_id: 'noun_haus', stage: 5 }, { word_id: 'other_geburts_jahr', stage: 3 },
    ]);
  } finally {
    await db.close();
  }
});
