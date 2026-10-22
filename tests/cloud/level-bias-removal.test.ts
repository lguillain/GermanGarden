import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { freshLearner } from '../../supabase/functions/garden/model.ts';

test('removing unused level bias preserves progress and supports current saves and imports', async () => {
  const db = new PGlite();
  const first = '00000000-0000-4000-8000-000000000001';
  const second = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      insert into auth.users values ('${first}'),('${second}');`);
    const removal = '202610220001_remove_level_bias.sql';
    for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql') && f < removal).sort())
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    const state = freshLearner('Existing');
    state.user.affinity_above = 1.4;
    state.known = ['known-word'];
    await db.query('select import_learner_progress($1,$2)', [first, JSON.stringify({ ...state, user: { ...state.user, level_bias: 1.7 } })]);
    const before = (await db.query<{ data: typeof state }>("select load_learner_progress($1,'Existing')->'data' data", [first])).rows[0].data;
    await db.exec(readFileSync(`supabase/migrations/${removal}`, 'utf8'));
    const after = (await db.query<{ data: typeof state }>("select load_learner_progress($1,'Existing')->'data' data", [first])).rows[0].data;
    const { level_bias, ...user } = before.user as typeof state.user & { level_bias: number };
    assert.equal(level_bias, 1.7);
    assert.deepEqual(after, { ...before, user });
    assert.equal((await db.query("select column_name from information_schema.columns where table_name='learner_profiles' and column_name='level_bias'")).rows.length, 0);
    await db.query('select save_learner_progress($1,0,$2)', [first, JSON.stringify({ user: { ...after.user, name: 'Updated' } })]);
    assert.equal((await db.query<{ name: string }>('select name from learner_profiles where user_id=$1', [first])).rows[0].name, 'Updated');
    await db.query('select import_learner_progress($1,$2)', [second, JSON.stringify(freshLearner('New'))]);
    await assert.rejects(db.query('select import_learner_progress($1,$2)', [second, JSON.stringify(state)]), /already exists/);
  } finally { await db.close(); }
});
