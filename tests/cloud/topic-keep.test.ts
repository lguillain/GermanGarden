import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { type Catalog, type Learner, freshLearner, HttpError } from '../../supabase/functions/garden/model.ts';
import { topicKeepResponse, type TopicKeepResult } from '../../supabase/functions/garden/topic-keep.ts';
import { progressChanges } from '../../supabase/functions/garden/persistence.ts';
import { dispatch } from '../../supabase/functions/garden/service.ts';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';

test('topic keep bypasses catalog/progress reads and ignores a browser-supplied user ID', async () => {
  const result: TopicKeepResult = { added: true, word: { id: 'word 1', lemma: 'Baum', pos: 'noun', english: 'tree', level: 'A2' },
    swipe: { word_id: 'word 1', activity_id: 'at home', sentence_id: null, action: 'keep', swiped_at: new Date().toISOString(), planted_at: null }, srs: null, learned: false };
  const response = await dispatch('/topics/at%20home/words/word%201/keep', 'POST', new URLSearchParams(), { user_id: second }, {
    async load() { throw new Error('Must not load progress'); },
    async save() { throw new Error('Must not save a full snapshot'); },
    async keepTopicWord(word, topic) { assert.equal(word, 'word 1'); assert.equal(topic, 'at home'); return result; },
  }, { words: [], activities: [], word_activities: [], sentences: [] });
  assert.deepEqual(response, topicKeepResponse(result));
  for (const [error, status] of [['unknown_word',404], ['unknown_topic',422], ['wrong_topic',422], ['bag_full',409]] as const)
    assert.throws(() => topicKeepResponse({error}), (e: unknown) => e instanceof HttpError && e.status === status);
});

test('atomic topic keep matches domain rules, protects versions, and preserves history', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      insert into auth.users values ('${first}'),('${second}');`);
    for (const name of ['202610190001_garden','202610200001_normalize_learners','202610200002_catalog_reads','202610200004_matcher_progress','202610200006_scoped_progress','202610200008_keep_topic_word'])
      await db.exec(readFileSync(`supabase/migrations/${name}.sql`, 'utf8'));
    await db.exec(`insert into activities values ('home','Home',null),('work','Work',null);
      insert into words(id,lemma,pos,english,level) select 'w'||n,'Wort'||n,'noun','word','A2' from generate_series(0,29) n;
      insert into word_activities select id,'home',3 from words;
      insert into sentences(id,word_id,activity_id,text,english,source) values
        (1,'w0','home','Ein Wort.','A word.','test'),(2,'w0','work','Arbeit.','Work.','test'),
        (3,'w1','work','Arbeit.','Work.','test');`);
    const initial = freshLearner('First');
    initial.user.level = 'A2'; initial.user.swipe_count = 120;
    initial.known = ['w1']; initial.learned = ['w2'];
    initial.swipes = [{ word_id: 'w3', activity_id: 'home', sentence_id: null, action: 'drop', drop_reason: 'uninteresting', planted_at: null, swiped_at: '2026-01-01T00:00:00Z' }];
    initial.reviews = [{ word_id: 'old', grade: 3, reviewed_at: '2026-01-01T00:00:00Z' }];
    await db.query('select import_learner_progress($1,$2)', [first, JSON.stringify(initial)]);
    const catalog = (await db.query<{ data: Catalog }>('select load_garden_catalog() data')).rows[0].data;
    async function load(user = first) { return (await db.query<{ data: { version: number; data: Learner } }>('select load_learner_progress($1,$2) data', [user,'Test'])).rows[0].data; }
    async function keep(id: string, topic = 'home', user = first) { return (await db.query<{ data: TopicKeepResult }>('select keep_topic_word($1,$2,$3,$4) data', [user,'Test',id,topic])).rows[0].data; }
    for (const id of ['w0','w1','w2','w3']) {
      const before = await load();
      const expected = new Garden(catalog, structuredClone(before.data));
      expected.add(id, 'home');
      const response = topicKeepResponse(await keep(id));
      assert.equal(response.added, true);
      assert.deepEqual(response.word, expected.details(expected.word(id)));
      const after = await load();
      assert.equal(after.version, before.version + 1);
      assert.deepEqual(after.data.user, before.data.user);
      assert.deepEqual(after.data.srs, before.data.srs);
      assert.deepEqual(after.data.known, before.data.known);
      assert.deepEqual(after.data.learned, before.data.learned);
      assert.deepEqual(after.data.swipes.slice(0,-1), before.data.swipes);
      assert.equal((await db.query<{ saved: boolean }>('select save_learner_progress($1,$2,$3) saved', [first,before.version,'{}'])).rows[0].saved, false);
      assert.equal(after.data.swipes.at(-1)?.sentence_id, id === 'w0' ? 1 : id === 'w1' ? 3 : null);
    }
    const beforeDuplicate = await load();
    assert.equal(topicKeepResponse(await keep('w0')).added, false);
    assert.deepEqual(await load(), beforeDuplicate);
    assert.deepEqual(await keep('missing'), { error: 'unknown_word' });
    assert.deepEqual(await keep('w0','missing'), { error: 'unknown_topic' });
    assert.deepEqual(await keep('w0','work'), { error: 'wrong_topic' });
    assert.deepEqual(await load(), beforeDuplicate);
    // Imported duplicate keeps and removed vocabulary must not consume extra slots.
    await db.query(`insert into learner_decisions(user_id,position,word_id,action,swiped_at,planted_at) values
      ($1,100,'w0','keep',now(),null),($1,101,'removed','keep',now(),null),
      ($1,102,'w28','keep',now(),now()),($1,103,'w28','keep',now(),null)`, [first]);
    for (let i=4;i<20;i++) assert.equal(topicKeepResponse(await keep(`w${i}`)).added, true);
    const full = await load();
    assert.deepEqual(await keep('w20'), { error: 'bag_full' });
    assert.deepEqual(await load(), full);
    assert.equal(topicKeepResponse(await keep('w0')).added, false);
    assert.equal(topicKeepResponse(await keep('w20','home',second)).added, true);
    assert.equal(new Garden(catalog,(await load(second)).data).bag().length, 1);
    // A review changes the shared version; a retry of add must return the planted word.
    const garden = new Garden(catalog, structuredClone(full.data));
    garden.grade('w0',3,'bag');
    await db.query('select save_learner_progress($1,$2,$3)', [first,full.version,JSON.stringify(progressChanges(full.data, garden.state))]);
    const planted = topicKeepResponse(await keep('w0'));
    assert.equal(planted.added, false); assert.equal(planted.word.status,'planted');
    assert.equal(topicKeepResponse(await keep('w20')).added, true);
    assert.equal((await db.query<{n:number}>('select count(*)::int n from learner_reviews where user_id=$1',[first])).rows[0].n,2);
    // Direct browser RPC access is forbidden even if it supplies another learner ID.
    await db.exec('set role authenticated');
    await assert.rejects(keep('w21'), /permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});
