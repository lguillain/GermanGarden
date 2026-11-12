import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tracksDatabase, account, otherAccount } from '../helpers/review-tracks.ts';
import { dispatch } from '../../supabase/functions/garden/service.ts';
import { Garden } from '../../supabase/functions/garden/domain.ts';

test('article migration, independent grading, production reinforcement and account isolation', async () => {
  const {db, catalog, store} = await tracksDatabase();
  try {
    const before = (await store().load()).data;
    assert.equal(before.srs.tree.interval_days, 25);
    assert.equal(before.srs.tree.article?.reps, 0);
    const call = (path: string, body: Record<string, unknown>, user = account) => dispatch(path, 'POST', new URLSearchParams(), body, store(user), catalog);
    const payload = {word_id:'tree', choice:'die', expected_article_reviewed_at:null, scope:'all', mode:'production'};
    await assert.rejects(call('/review/article', payload, otherAccount), /no longer due/);
    await call('/review/article', payload);
    const articleState = (await store().load()).data;
    assert.equal(articleState.srs.tree.article?.last_grade, 1);
    assert.equal(articleState.srs.tree.article?.lapses, 1);
    assert.equal(articleState.srs.tree.due_at, before.srs.tree.due_at);
    assert.deepEqual(articleState.srs.tree.production, before.srs.tree.production);
    await assert.rejects(call('/review/article', payload), /already reviewed/);
    await call('/review', {word_id:'tree', grade:3, track:'production', mode:'production'});
    const after = (await store().load()).data;
    assert.equal(after.srs.tree.last_grade, 3);
    assert.equal(after.srs.tree.production?.last_grade, 3);
    assert.equal(after.srs.tree.article?.last_grade, 3);
    await db.query("update learner_srs set article.due_at='2000-01-01' where user_id=$1", [account]);
    for (const mode of ['recognition','production','article'] as const) {
      const selection = await dispatch('/review','GET',new URLSearchParams({mode}),{},store(),catalog) as {remaining:number};
      assert.equal(selection.remaining, mode === 'article' ? 1 : 0);
    }
    const current = (await store().load()).data;
    const garden = new Garden(catalog, current);
    assert.equal(garden.home().summary.due_now, 1);
    assert.equal(garden.home().summary.due_today, 1);
    await call('/review/article', {...payload, mode:'article', choice:'der', expected_article_reviewed_at:current.srs.tree.article!.last_review_at});
    const final = (await store().load()).data;
    assert.equal(final.srs.tree.article?.last_grade, 3);
    assert.equal(final.srs.tree.due_at, after.srs.tree.due_at);
    assert.deepEqual(final.srs.tree.production, after.srs.tree.production);
  } finally { await db.close(); }
});

test('article choice plants a seed and its interrupted meaning check can finish in the seed bag', async () => {
  const {db, catalog, store} = await tracksDatabase();
  try {
    await db.query('delete from learner_srs where user_id=$1',[account]);
    await db.query('update learner_decisions set planted_at=null where user_id=$1',[account]);
    await dispatch('/review/article','POST',new URLSearchParams(),{word_id:'tree', choice:'der', expected_article_reviewed_at:null, mode:'recognition', scope:'bag'},store(),catalog);
    const state = (await store().load()).data;
    assert.ok(state.swipes[0].planted_at);
    assert.equal(state.srs.tree.last_review_at, null);
    await dispatch('/review','POST',new URLSearchParams(),{word_id:'tree', grade:3, track:'recognition', mode:'recognition', scope:'bag', continuation:true},store(),catalog);
    const after = (await store().load()).data;
    assert.equal(after.srs.tree.last_grade,3);
    assert.deepEqual(after.srs.tree.article,state.srs.tree.article);
  } finally { await db.close(); }
});

test('wrong article rates production Good and article Again atomically', async () => {
  const {db, catalog, store} = await tracksDatabase();
  try {
    await dispatch('/review', 'POST', new URLSearchParams(), {
      word_id: 'tree', grade: 3, track: 'production', mode: 'production', wrong_article: true,
    }, store(), catalog);
    const state = (await store().load()).data;
    assert.equal(state.srs.tree.production?.last_grade, 3);
    assert.equal(state.srs.tree.last_grade, 3);
    assert.equal(state.srs.tree.article?.last_grade, 1);
    const garden = new Garden(catalog, state, Date.parse(state.srs.tree.article!.due_at!) + 1000);
    assert.equal(garden.review('all', '', [], 'article').card?.word_id, 'tree');
    assert.equal(garden.review('all', '', [], 'production').remaining, 0);
    assert.equal(garden.review('all', '', [], 'recognition').remaining, 0);
    await assert.rejects(dispatch('/review', 'POST', new URLSearchParams(), {
      word_id: 'tree', grade: 3, track: 'recognition', mode: 'recognition', wrong_article: true,
    }, store(), catalog), /Wrong article requires/);
  } finally { await db.close(); }
});


test('Good and Easy production reinforce articles as Good even before they are due', async () => {
  const {db, catalog, store} = await tracksDatabase();
  try {
    for (const grade of [3, 4]) {
      await db.query("update learner_srs set production.due_at='2000-01-01', article=row(2.5,10,3,0,'review','2099-01-01',3,'2000-01-01')::review_schedule where user_id=$1", [account]);
      await dispatch('/review','POST',new URLSearchParams(),{word_id:'tree', grade, track:'production', mode:'production'},store(),catalog);
      const state = (await store().load()).data;
      assert.equal(state.srs.tree.production?.last_grade, grade);
      assert.equal(state.srs.tree.last_grade, grade);
      assert.equal(state.srs.tree.article?.last_grade, 3);
      assert.equal(state.srs.tree.article?.interval_days, 25.5);
    }
  } finally { await db.close(); }
});

test('scope totals exclude article-only words in Review and vocabulary-only words in Articles', async () => {
  const {db, catalog, store} = await tracksDatabase();
  try {
    const check = async (vocabulary: number, articles: number) => {
      const garden = new Garden(catalog, (await store().load()).data);
      for (const mode of ['recognition','production','article'] as const) {
        for (const scope of ['all','topic','bag']) {
          const topic = scope === 'topic' ? 'home' : '';
          const selection = await dispatch('/review','GET',new URLSearchParams({mode,scope,topic}),{},store(),catalog) as {counts:{plants:number;seeds:number}};
          assert.deepEqual(selection.counts, {plants:mode === 'article' ? articles : vocabulary,seeds:0});
          assert.deepEqual(selection.counts, garden.review(scope,topic,[],mode).counts);
        }
      }
    };
    await check(1,1); // Both vocabulary directions due still count once.
    await db.query("update learner_srs set due_at='2099-01-01', production.due_at='2099-01-01' where user_id=$1",[account]);
    await check(0,1);
    await db.query("update learner_srs set due_at='2000-01-01', article.due_at='2099-01-01' where user_id=$1",[account]);
    await check(1,0);
  } finally { await db.close(); }
});
