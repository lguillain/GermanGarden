import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('object vocabulary migration preserves typical pairings and rejects topical false positives', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table words (id text primary key, pos text);
      insert into words values ('noun_vertrag','noun'), ('noun_wohnung','noun'), ('noun_haus','noun'),
      ('noun_geld','noun'), ('verb_vermieten','verb'), ('verb_abschliessen','verb'),
      ('verb_kundigen','verb'), ('verb_unterschreiben','verb'), ('verb_sparen','verb'), ('verb_ausgeben','verb');`);
    await db.exec(readFileSync('supabase/migrations/202611020001_verb_objects.sql', 'utf8'));
    const data = readFileSync('supabase/migrations/202611020002_verb_objects_data.sql', 'utf8');
    await db.exec(data);
    await db.exec(data);
    await db.exec('set role authenticated');
    const contract = await db.query<{ verb_id: string }>("select verb_id from verb_objects where noun_id='noun_vertrag' order by verb_id");
    assert.deepEqual(contract.rows.map(r => r.verb_id), ['verb_abschliessen', 'verb_kundigen', 'verb_unterschreiben']);
    const rent = await db.query<{ phrase: string }>("select phrase from verb_objects where verb_id='verb_vermieten' order by phrase");
    assert.deepEqual(rent.rows.map(r => r.phrase), ['ein Haus vermieten', 'eine Wohnung vermieten']);
    const money = await db.query<{ verb_id: string }>("select verb_id from verb_objects where noun_id='noun_geld' order by verb_id");
    assert.deepEqual(money.rows.map(r => r.verb_id), ['verb_ausgeben', 'verb_sparen']);
    await assert.rejects(db.exec("insert into verb_objects values ('verb_vermieten','noun_vertrag','einen Vertrag vermieten')"), /permission denied/);
  } finally { await db.close(); }
});
