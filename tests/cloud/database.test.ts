import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const userA = '00000000-0000-4000-8000-000000000001', userB = '00000000-0000-4000-8000-000000000002';
test('migration enforces per-user reads, server-only writes and atomic version checks', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users values ('${userA}'), ('${userB}');`);
    await db.exec(readFileSync('supabase/migrations/202610190001_garden.sql', 'utf8'));
    await db.exec(`insert into public.learner_state(user_id,data) values ('${userA}','{"name":"A"}'), ('${userB}','{"name":"B"}');`);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${userA}';`);
    const own = await db.query<{ user_id: string }>('select user_id from public.learner_state');
    assert.deepEqual(own.rows, [{ user_id: userA }]);
    await assert.rejects(db.exec(`update public.learner_state set data='{}'`), /permission denied/);
    await assert.rejects(db.exec(`select public.save_learner_state('${userB}',0,'{}')`), /permission denied/);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.exec('select * from public.learner_state'), /permission denied/);
    await db.exec('reset role; set role service_role;');
    const saved = await db.query<{ saved: boolean }>(`select public.save_learner_state('${userA}',0,'{"name":"Updated"}') as saved`);
    assert.equal(saved.rows[0].saved, true);
    const stale = await db.query<{ saved: boolean }>(`select public.save_learner_state('${userA}',0,'{}') as saved`);
    assert.equal(stale.rows[0].saved, false);
    const row = await db.query<{ data: { name: string }; version: number }>(`select data,version from public.learner_state where user_id='${userA}'`);
    assert.equal(row.rows[0].data.name, 'Updated'); assert.equal(Number(row.rows[0].version), 1);
  } finally { await db.close(); }
});
