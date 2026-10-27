import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tracksDatabase, account, otherAccount } from '../helpers/review-tracks.ts';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { initialSrs, growth } from '../../supabase/functions/garden/scheduler.ts';
import { dispatch } from '../../supabase/functions/garden/service.ts';

test('migration, atomic persistence, production priority, graduation and permanent Learned status', async () => {
  const { db, catalog, store } = await tracksDatabase();
  try {
    const before = await store().load();
    assert.equal(before.data.srs.tree.interval_days, 25);
    assert.equal(before.data.srs.tree.production?.interval_days, 0);
    assert.equal(before.data.srs.tree.production?.state, 'learning');
    const compact = await store().review!('all', '');
    const g = new Garden(catalog, structuredClone(before.data));
    assert.equal(compact.remaining, 1);
    assert.equal(g.review().card?.track, 'production');
    const recognition = structuredClone(g.state.srs.tree);
    delete recognition.production;
    const failed = g.grade('tree', 1, 'all', '', 'production');
    assert.equal(failed.card, null);
    assert.equal(g.state.srs.tree.interval_days, recognition.interval_days);
    assert.equal(g.state.srs.tree.due_at, recognition.due_at);
    assert.equal(g.review().card?.track, 'recognition');
    assert.equal(g.review('all', '', ['tree']).card, null);
    // Both schedules mature on the same production rating; recognition need not be due.
    g.state.srs.tree = {
      ...recognition,
      due_at: '2099-01-01T00:00:00Z',
      production: { ...recognition },
    };
    const success = g.grade('tree', 3, 'all', '', 'production');
    assert.equal(success.graduated?.growth, 5);
    assert.ok(Math.abs(g.state.srs.tree.interval_days - 63.75) < 1e-10);
    assert.ok(Math.abs(g.state.srs.tree.production!.interval_days - 63.75) < 1e-10);
    assert.equal(g.state.srs.tree.due_at, g.state.srs.tree.production?.due_at);
    const writer = store();
    const snapshot = await writer.load();
    assert.equal(await writer.save(snapshot.version, g.state), true);
    const roundTrip = await store().load();
    assert.ok(Math.abs(roundTrip.data.srs.tree.production!.interval_days - 63.75) < 1e-10);
    await dispatch(
      '/review/learned',
      'POST',
      new URLSearchParams(),
      { word_id: 'tree' },
      store(),
      catalog,
    );
    const learned = new Garden(catalog, (await store().load()).data, Date.parse('2100-01-01'));
    assert.equal(learned.details(learned.word('tree')).growth, 5);
    assert.equal(learned.details(learned.word('tree')).review_due, false);
    assert.equal(learned.review().card, null);
    assert.throws(() => learned.add('tree', 'home'), /permanently complete/);
    assert.equal((await store().review!('all', '')).remaining, 0);
    assert.deepEqual((await store(otherAccount).load()).data.learned, []);
    assert.deepEqual(
      (
        await db.query<{ v: unknown }>('select keep_topic_word($1,$2,$3,$4) v', [
          account,
          'Test',
          'tree',
          'home',
        ])
      ).rows[0].v,
      { error: 'learned' },
    );
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('select load_review_selection($1)', [account]),
      /permission denied/,
    );
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});

test('unlock is permanent, Hard affects production only, practice is inert, maturity requires 55 days', async () => {
  const { db, catalog, store } = await tracksDatabase();
  try {
    const g = new Garden(catalog, (await store().load()).data);
    g.state.srs.tree = {
      ...initialSrs(),
      state: 'review',
      interval_days: 4,
      reps: 2,
      due_at: '2020-01-01',
    };
    const unlock = g.grade('tree', 3);
    assert.equal(unlock.card, null);
    assert.equal(g.state.srs.tree.production?.interval_days, 0);
    const before = structuredClone(g.state);
    g.practice('all', '');
    g.targets('all', '');
    assert.deepEqual(g.state, before);
    g.grade('tree', 2, 'all', '', 'production');
    assert.equal(g.state.srs.tree.interval_days, 10.2);
    assert.equal(g.state.srs.tree.production?.interval_days, 1);
    assert.equal(g.state.srs.tree.production?.due_at, new Date(g.now + 86400000).toISOString());
    assert.equal(g.state.srs.tree.due_at, before.srs.tree.due_at);
    g.state.srs.tree.due_at = '2020-01-01';
    g.grade('tree', 1);
    assert.ok(g.state.srs.tree.production);
    assert.equal(g.details(g.word('tree')).growth, 0);
    assert.equal(growth({ ...initialSrs(), interval_days: 54.999 }), 4);
    assert.equal(growth({ ...initialSrs(), interval_days: 55 }), 5);
    assert.throws(() => g.markLearned('tree'), /55-day/);
  } finally {
    await db.close();
  }
});

test('imports preserve production progress and reject unknown nested fields; practice includes matcher Learned words', async () => {
  const { db, catalog, store } = await tracksDatabase();
  try {
    const state = (await store().load()).data;
    state.srs.tree.production = {
      ...initialSrs(),
      interval_days: 21,
      reps: 4,
      state: 'review',
      due_at: '2030-01-01T00:00:00Z',
    };
    state.reviews = [
      { word_id: 'tree', grade: 3, track: 'production', reviewed_at: '2026-01-01T00:00:00Z' },
    ];
    const imported = '00000000-0000-4000-8000-000000000003';
    await db.query('insert into auth.users values ($1)', [imported]);
    await db.query('select import_learner_progress($1,$2)', [imported, JSON.stringify(state)]);
    assert.equal((await store(imported).load()).data.srs.tree.production?.interval_days, 21);
    assert.equal(
      (
        await db.query<{ track: string }>('select track from learner_reviews where user_id=$1', [
          imported,
        ])
      ).rows[0].track,
      'production',
    );
    const invalid = structuredClone(state);
    Object.assign(invalid.srs.tree.production!, { unknown_field: 1 });
    await assert.rejects(
      db.query('select import_learner_progress($1,$2)', [imported, JSON.stringify(invalid)]),
      /Unrecognized production/,
    );
    const summary = (
      await db.query<{ data: { all_plants: number } }>('select load_practice_summary($1) data', [
        account,
      ])
    ).rows[0].data;
    assert.equal(summary.all_plants, 2);
    assert.equal(new Garden(catalog, state).scope().length, 2);
    assert.equal(new Garden(catalog, state).home().summary.planted_total, 1);
  } finally {
    await db.close();
  }
});

test('time tracking migration removes stored time and RPCs while preserving learning progress', async () => {
  const { db, store } = await tracksDatabase();
  try {
    const state = (await store().load()).data;
    assert.equal(state.srs.tree.interval_days, 25);
    assert.deepEqual(state.known, ['flower']);
    assert.equal('sessions' in state, false);
    assert.equal('time_summary' in state, false);
    const result = await db.query<{ table_name: string | null; heartbeat: string | null; summary: string | null }>(`
      select to_regclass('public.learner_sessions')::text table_name,
        to_regprocedure('public.heartbeat_learner(uuid,text,timestamp with time zone)')::text heartbeat,
        to_regprocedure('public.learner_time(uuid,timestamp with time zone)')::text summary`);
    assert.deepEqual(result.rows[0], { table_name: null, heartbeat: null, summary: null });
  } finally { await db.close(); }
});
