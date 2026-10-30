import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { type Catalog, type Swipe, type Word, freshLearner } from '../../supabase/functions/garden/model.ts';
import { Garden } from '../../supabase/functions/garden/domain.ts';

const word = (id: string, level = 'A2', pos = 'adj'): Word => ({ id, lemma: id, pos, english: id, level });
const fillers = Array.from({ length: 20 }, (_, n) => word(`filler-${n}`));
const words = [word('Zug', 'A2', 'noun'), word('Bahnhof', 'A2', 'noun'), word('Gleis', 'B1', 'noun'), word('See', 'A2', 'noun'), ...fillers];
const topicOf = (id: string) => (id === 'See' ? 'nature' : 'travel');
const catalog: Catalog = {
  activities: [{ id: 'travel', name: 'Travel' }, { id: 'nature', name: 'Nature' }],
  words,
  word_activities: words.map((w) => ({ word_id: w.id, activity_id: topicOf(w.id), relevance: 3 })),
  sentences: words.map((w, n) => ({ id: n + 1, word_id: w.id, activity_id: topicOf(w.id), text: w.id, english: w.id })),
  associations: { Zug: ['See', 'Gleis', 'Bahnhof'] },
};

function nextCards(last: Partial<Swipe>, rounds = 400) {
  const counts = new Map<string, number>();
  for (let n = 0; n < rounds; n++) {
    const learner = freshLearner('Test');
    Object.assign(learner.user, { level: 'A2', current_topic: 'travel', affinity_below: 0, affinity_above: 0 });
    learner.swipes = [{ word_id: 'Zug', activity_id: 'travel', sentence_id: 1, swiped_at: '2026-01-01T00:00:00Z', planted_at: null, action: 'keep', ...last }];
    const id = new Garden(catalog, learner).matcher().card!.word_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return (id: string) => (counts.get(id) ?? 0) / rounds;
}

test('related words often follow Keep and Learned, but only from the same topic and level', () => {
  for (const last of [{ action: 'keep' }, { action: 'drop', drop_reason: 'known' }] as Partial<Swipe>[]) {
    const share = nextCards(last);
    assert.ok(share('Bahnhof') > 0.6 && share('Bahnhof') < 0.85, `Bahnhof follows ${share('Bahnhof')}`);
    assert.equal(share('See'), 0); // another topic
    assert.equal(share('Gleis'), 0); // another level
  }
  assert.ok(nextCards({ action: 'drop', drop_reason: 'uninteresting' })('Bahnhof') < 0.2); // Not now
});

test('discovery catalogue includes ranked associations only when requested', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
    for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
      if (file.endsWith('_word_associations_data.sql')) continue;
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    await db.exec(`insert into activities values ('travel','Travel',null);
      insert into words(id,lemma,pos,english,level) values
        ('zug','Zug','noun','train','A2'),('bahnhof','Bahnhof','noun','station','A2'),('gleis','Gleis','noun','track','B1');
      insert into word_associations values ('zug','gleis',2),('zug','bahnhof',1),('bahnhof','zug',1);`);
    const load = async (sql: string) => (await db.query<{ data: Catalog }>(`select ${sql} data`)).rows[0].data;
    assert.deepEqual((await load('load_garden_catalog(p_include_associations => true)')).associations, {
      zug: ['bahnhof', 'gleis'], bahnhof: ['zug'],
    });
    assert.deepEqual((await load('load_garden_catalog()')).associations, {});
    assert.equal((await load('load_garden_catalog()')).words.length, 3);
    await db.exec('set role authenticated');
    await assert.rejects(db.exec('select load_garden_catalog()'), /permission denied/);
  } finally { await db.close(); }
});
