import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { freshLearner, Learner } from '../../supabase/functions/garden/model.ts';
import { initialSrs } from '../../supabase/functions/garden/scheduler.ts';
import { progressChanges } from '../../supabase/functions/garden/persistence.ts';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { dispatch, Store } from '../../supabase/functions/garden/service.ts';
const userA = '00000000-0000-4000-8000-000000000001', userB = '00000000-0000-4000-8000-000000000002';
const migration = readFileSync('supabase/migrations/202610200001_normalize_learners.sql', 'utf8');
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${userA}'), ('${userB}');`);
  await db.exec(readFileSync('supabase/migrations/202610190001_garden.sql', 'utf8'));
  return db;
}
function source() {
  const state = { ...freshLearner('Léa'), sessions: [] as { started_at: string; last_beat_at: string; seconds: number }[] }; state.user.level = 'A2'; state.user.swipe_count = 2;
  state.user.level_bias = 0.30000000000000004; state.user.affinity_above = 1.4400000000000002;
  state.swipes = [{ word_id: 'word', activity_id: 'home', sentence_id: 1, action: 'keep', swiped_at: '2026-10-01T10:00:00Z', planted_at: null }];
  state.srs.word = { ...initialSrs(), due_at: '2026-10-20T10:00:00Z' };
  state.known = ['known']; state.learned = ['learned']; state.weights = { home: 1.5 };
  state.reviews = [{ word_id: 'word', grade: 3, reviewed_at: '2026-10-01T10:00:00Z' }];
  state.sessions = [{ started_at: '2026-10-01T10:00:00Z', last_beat_at: '2026-10-01T10:00:42Z', seconds: 42 }];
  return state;
}
async function load(db: PGlite, userId = userA) {
  const result = await db.query<{ snapshot: { version: number; data: Learner & { sessions: unknown[]; time_summary?: { total_seconds: number } } } }>('select public.load_learner_progress($1,$2) as snapshot', [userId, 'Test']);
  return result.rows[0].snapshot;
}
async function save(db: PGlite, version: number, changes: unknown) {
  const result = await db.query<{ saved: boolean }>('select public.save_learner_progress($1,$2,$3) as saved', [userA, version, JSON.stringify(changes)]);
  return result.rows[0].saved;
}

test('migration copies every collection, preserves versions and removes all JSON storage', async () => {
  const db = await setup();
  try {
    const original = source();
    await db.query('insert into learner_state(user_id,version,data) values ($1,7,$2),($3,0,$4)', [userA, JSON.stringify(original), userB, JSON.stringify(freshLearner('B'))]);
    await db.exec(migration);
    const snapshot = await load(db);
    assert.equal(Number(snapshot.version), 7);
    assert.deepEqual(snapshot.data.user, original.user);
    assert.deepEqual(snapshot.data.known, original.known);
    assert.deepEqual(snapshot.data.learned, original.learned);
    assert.deepEqual(snapshot.data.weights, original.weights);
    assert.equal(Date.parse(snapshot.data.srs.word.due_at!), Date.parse(original.srs.word.due_at!));
    assert.equal(snapshot.data.swipes[0].word_id, 'word');
    assert.deepEqual(snapshot.data.reviews, []); assert.deepEqual(snapshot.data.sessions, []);
    assert.equal(snapshot.data.time_summary?.total_seconds, 42);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from learner_reviews')).rows[0].n, 1);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from learner_sessions')).rows[0].n, 1);
    assert.equal((await db.query<{ name: string | null }>("select to_regclass('public.learner_state')::text as name")).rows[0].name, null);
    assert.deepEqual((await db.query("select column_name from information_schema.columns where table_schema='public' and data_type in ('json','jsonb')")).rows, []);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${userA}';`);
    for (const table of ['learner_profiles','learner_decisions','learner_word_marks','learner_srs','learner_topic_weights','learner_reviews','learner_sessions']) {
      const own = await db.query<{ user_id: string }>(`select user_id from ${table}`);
      assert.ok(own.rows.every(row => row.user_id === userA));
      await assert.rejects(db.exec(`delete from ${table}`), /permission denied/);
    }
    for (const call of [
      `load_learner_progress('${userB}','B')`, `save_learner_progress('${userB}',0,'{}')`,
      `heartbeat_learner('${userB}','B')`, `import_learner_progress('${userB}','{}')`,
      `apply_learner_changes('${userB}','{}')`, `learner_time('${userB}')`,
    ]) await assert.rejects(db.exec(`select public.${call}`), /permission denied/);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.exec('select * from learner_profiles'), /permission denied/);
    await db.exec('reset role; set role service_role;');
    assert.equal(await save(db, 7, { user: { ...original.user, name: 'Updated' } }), true);
    assert.equal(await save(db, 7, { user: { ...original.user, name: 'Stale' } }), false);
    assert.equal((await load(db)).data.user.name, 'Updated');
  } finally { await db.close(); }
});

test('invalid source data rolls the entire migration back without removing the original', async () => {
  const db = await setup();
  try {
    const invalid = source(); invalid.sessions[0].seconds = -1;
    await db.query('insert into learner_state(user_id,data) values ($1,$2)', [userA, JSON.stringify(invalid)]);
    await assert.rejects(db.exec(migration), /check constraint/);
    await db.exec('rollback');
    assert.deepEqual((await db.query<{ data: Learner & { sessions: unknown[]; time_summary?: { total_seconds: number } } }>('select data from learner_state')).rows[0].data, invalid);
    assert.equal((await db.query<{ name: string | null }>("select to_regclass('public.learner_profiles')::text as name")).rows[0].name, null);
  } finally { await db.close(); }
});

test('heartbeats touch only sessions and retain concurrent review changes and historical time', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    await db.query('select import_learner_progress($1,$2)', [userA, JSON.stringify(source())]);
    const before = await load(db);
    for (const time of ['2026-10-20T23:59:50Z', '2026-10-21T00:00:05Z', '2026-10-21T00:00:05Z']) {
      await db.query('select heartbeat_learner($1,$2,$3)', [userA, 'Test', time]);
    }
    const after = structuredClone(before.data);
    after.srs.word = { ...after.srs.word, reps: 1 };
    after.reviews.push({ word_id: 'word', grade: 3, reviewed_at: '2026-10-21T00:00:05Z' });
    assert.equal(await save(db, before.version, progressChanges(before.data, after)), true);
    const summary = await db.query<{ data: { total_seconds: number; today_seconds: number } }>('select learner_time($1,$2) data', [userA, '2026-10-21T00:00:05Z']);
    assert.deepEqual(summary.rows[0].data.total_seconds, 57);
    assert.equal(summary.rows[0].data.today_seconds, 15);
    assert.equal((await load(db)).data.srs.word.reps, 1);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from learner_reviews')).rows[0].n, 2);
    assert.equal(await save(db, before.version, progressChanges(before.data, after)), false);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from learner_reviews')).rows[0].n, 2);
  } finally { await db.close(); }
});

test('normalized persistence retries concurrent additions without overfilling the seed bag', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    const catalog = { words: Array.from({ length: 21 }, (_, i) => ({ id: `w${i}`, lemma: `W${i}`, pos: 'noun', english: 'word', level: 'A2' })), activities: [{ id: 'home', name: 'Home' }], word_activities: Array.from({ length: 21 }, (_, i) => ({ word_id: `w${i}`, activity_id: 'home', relevance: 3 })), sentences: [] };
    const garden = new Garden(catalog, freshLearner('Test')); garden.state.user.level = 'A2';
    for (let i = 0; i < 19; i++) garden.add(`w${i}`, 'home');
    await db.query('select import_learner_progress($1,$2)', [userA, JSON.stringify(garden.state)]);
    function store(): Store {
      let snapshot: Awaited<ReturnType<typeof load>>;
      return { async load() { snapshot = await load(db); return structuredClone(snapshot); }, async save(version, data) { return save(db, version, progressChanges(snapshot.data, data)); } };
    }
    const results = await Promise.allSettled([19,20].map(i => dispatch(`/topics/home/words/w${i}/keep`, 'POST', new URLSearchParams(), {}, store(), catalog)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(new Garden(catalog,(await load(db)).data).bag().length, 20);
    const reviews = await Promise.allSettled([1,2].map(() =>
      dispatch('/review', 'POST', new URLSearchParams(), { word_id: 'w0', grade: 3, scope: 'bag' }, store(), catalog)));
    assert.equal(reviews.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from learner_reviews')).rows[0].n, 1);
    assert.equal(new Garden(catalog,(await load(db)).data).bag().length, 19);
  } finally { await db.close(); }
});

test('compact matcher reads preserve history and atomically append decisions without overwriting reviews', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    await db.exec(readFileSync('supabase/migrations/202610200004_matcher_progress.sql', 'utf8'));
    const state = source();
    state.swipes.push({ ...state.swipes[0], word_id: 'planted', planted_at: '2026-10-01T10:00:00Z' });
    state.srs.planted = initialSrs();
    await db.query('select import_learner_progress($1,$2)', [userA, JSON.stringify(state)]);
    const read = async (id = userA) => (await db.query<{ snapshot: { version: number; data: Learner & { sessions: unknown[]; time_summary?: { total_seconds: number } } } }>('select load_matcher_progress($1,$2) snapshot', [id, 'Test'])).rows[0].snapshot;
    const original = (await load(db)).data;
    const before = await read();
    assert.deepEqual(before.data.swipes.map(s => s.word_id), ['word']);
    assert.deepEqual(new Set(before.data.seen_ids), new Set(['word', 'planted']));
    assert.deepEqual(Object.keys(before.data.srs), ['word']);
    assert.deepEqual(before.data.weights, {});
    assert.equal(before.data.time_summary, undefined);
    assert.deepEqual((await read(userB)).data.seen_ids, []);
    const decision = { ...state.swipes[0], word_id: 'next', action: 'drop', drop_reason: 'known' };
    const write = async (version: number) => (await db.query<{ ok: boolean }>('select save_matcher_progress($1,$2,$3,$4,$5) ok', [userA, version, JSON.stringify(before.data.user), JSON.stringify([decision]), JSON.stringify(['next'])])).rows[0].ok;
    assert.equal(await write(before.version), true);
    assert.equal(await write(before.version), false);
    const after = (await load(db)).data;
    assert.deepEqual(after.swipes.slice(0, 2), original.swipes);
    assert.equal(after.swipes[2].word_id, 'next');
    assert.deepEqual(after.known, ['known', 'next']);
    assert.deepEqual(after.learned, state.learned);
    assert.deepEqual(after.srs, original.srs);
    assert.deepEqual(after.weights, state.weights);
    assert.equal((await db.query<{ n: number }>('select count(*)::int n from learner_reviews')).rows[0].n, 1);
    await assert.rejects(write((await read()).version), /already handled/);
    // All learner reads/writes remain service-only, including forged user IDs.
    await db.exec('set role authenticated');
    await assert.rejects(read(userA), /permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('compact matcher retries competing final-slot keeps and rejects duplicate decisions', async () => {
  const db = await setup();
  try {
    await db.exec(migration);
    await db.exec(readFileSync('supabase/migrations/202610200004_matcher_progress.sql', 'utf8'));
    const catalog = { words: Array.from({ length: 23 }, (_, i) => ({ id: `w${i}`, lemma: `W${i}`, pos: 'noun', english: 'word', level: 'A2' })), activities: [{ id: 'home', name: 'Home' }], word_activities: Array.from({ length: 23 }, (_, i) => ({ word_id: `w${i}`, activity_id: 'home', relevance: 3 })), sentences: Array.from({ length: 23 }, (_, i) => ({ id: i, word_id: `w${i}`, activity_id: 'home', text: 'Example', english: 'Example' })) };
    const garden = new Garden(catalog, freshLearner('Test')); garden.state.user.level = 'A2';
    for (let i = 0; i < 19; i++) garden.add(`w${i}`, 'home');
    await db.query('select import_learner_progress($1,$2)', [userA, JSON.stringify(garden.state)]);
    function store(): Store {
      let snapshot: Awaited<ReturnType<typeof load>>;
      return {
        async load() { snapshot = (await db.query<{ snapshot: typeof snapshot }>('select load_matcher_progress($1,$2) snapshot', [userA, 'Test'])).rows[0].snapshot; return structuredClone(snapshot); },
        async save(version, data) { return (await db.query<{ ok: boolean }>('select save_matcher_progress($1,$2,$3,$4,$5) ok', [userA, version, JSON.stringify(data.user), JSON.stringify(data.swipes.slice(snapshot.data.swipes.length)), JSON.stringify(data.known.slice(snapshot.data.known.length))])).rows[0].ok; },
      };
    }
    const results = await Promise.allSettled([19,20].map(i => dispatch('/matcher', 'POST', new URLSearchParams(), { action: 'keep', word_id: `w${i}`, activity_id: 'home', sentence_id: i }, store(), catalog)));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(new Garden(catalog, (await load(db)).data).bag().length, 20);
    const duplicates = await Promise.allSettled([1,2].map(() => dispatch('/matcher', 'POST', new URLSearchParams(), { action: 'learned', word_id: 'w21', activity_id: 'home', sentence_id: 21 }, store(), catalog)));
    assert.equal(duplicates.filter(r => r.status === 'fulfilled').length, 1);
    assert.deepEqual((await load(db)).data.known, ['w21']);
  } finally { await db.close(); }
});
