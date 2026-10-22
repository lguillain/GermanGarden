import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('SQLite export preserves Unicode, quotes, review dates, progress without overwriting accounts', async () => {
  const userId = '00000000-0000-4000-8000-000000000003';
  const sql = execFileSync('python3', ['-c', `
import runpy, sqlite3, tempfile
from pathlib import Path
exporter = runpy.run_path('scripts/export-supabase.py')
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / 'source.sqlite'
    with sqlite3.connect(path) as conn:
        conn.executescript(Path('schema.sql').read_text())
        conn.execute("INSERT INTO words VALUES (?,?,?,?,?,?,?)", ('word', 'Ärztin', 'die', 'Ärztinnen', 'noun', "doctor's", 'A2'))
        conn.execute("INSERT INTO activities VALUES ('doctor','Doctor','Visits')")
        conn.execute("INSERT INTO word_activities VALUES ('word','doctor',3)")
        conn.execute("INSERT INTO sentences(word_id,activity_id,text,english,source) VALUES ('word','doctor','Die Ärztin kommt.','The doctor arrives.','llm')")
        conn.execute("INSERT INTO user_state(id,name,level,swipe_count) VALUES (1,'Léa','A2',1)")
        conn.execute("INSERT INTO swipes(word_id,activity_id,sentence_id,action,swiped_at,planted_at) VALUES ('word','doctor',1,'keep','2026-10-01 10:00:00','2026-10-01 10:05:00')")
        conn.execute("INSERT INTO word_srs(word_id,reps,interval_days,state,due_at) VALUES ('word',3,7,'review','2026-10-20 10:00:00')")
        conn.execute("INSERT INTO reviews(word_id,grade) VALUES ('word',3)")
        conn.commit()
    before = path.read_bytes()
    print(exporter['export'](path,path,'${userId}'))
    assert path.read_bytes() == before
`], { encoding: 'utf8' });
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      insert into auth.users values ('${userId}');`);
    for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort())
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    await db.exec(sql);
    const { rows } = await db.query<{ data: { user: { name: string }; srs: Record<string, { due_at: string; reps: number }>; swipes: { planted_at: string }[] } }>("select load_learner_progress(user_id,'Test')->'data' as data from learner_profiles");
    assert.equal(rows[0].data.user.name, 'Léa');
    assert.equal(Date.parse(rows[0].data.srs.word.due_at), Date.parse('2026-10-20T10:00:00Z'));
    assert.equal(rows[0].data.srs.word.reps, 3);
    assert.equal(Date.parse(rows[0].data.swipes[0].planted_at), Date.parse('2026-10-01T10:05:00Z'));
    const words = await db.query<{ english: string }>('select english from words'); assert.equal(words.rows[0].english, "doctor's");
    await assert.rejects(db.exec(sql), /already exists/);
    await db.exec('ROLLBACK;');
    const count = await db.query<{ n: number }>('select count(*)::int as n from learner_profiles'); assert.equal(count.rows[0].n, 1);
  } finally { await db.close(); }
});

test('bulk import keeps profiles separate and reruns preserve newer progress', async () => {
  const ids = ['00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012'];
  const sql = execFileSync('python3', ['-c', `
import runpy, sqlite3, tempfile
from pathlib import Path
exporter = runpy.run_path('scripts/export-supabase.py')
with tempfile.TemporaryDirectory() as directory:
    profiles = []
    for i, user_id in enumerate(${JSON.stringify(ids)}):
        path = Path(directory) / f'profile-{i}.sqlite'
        with sqlite3.connect(path) as conn:
            conn.executescript(Path('schema.sql').read_text())
            conn.execute("INSERT INTO words VALUES (?,?,?,?,?,?,?)", ('word', 'Baum', 'der', 'Bäume', 'noun', 'tree', 'A2'))
            conn.execute("INSERT INTO user_state(id,name,level) VALUES (1,?,'A2')", (f'Learner {i}',))
            if i == 0:
                conn.execute("INSERT INTO swipes(word_id,action) VALUES ('word','keep')")
            else:
                conn.execute("INSERT INTO known_words(word_id) VALUES ('word')")
            conn.commit()
        profiles.append((path,user_id))
    original = [p.read_bytes() for p,_ in profiles]
    print(exporter['export_many'](profiles[0][0], profiles, skip_existing=True))
    assert original == [p.read_bytes() for p,_ in profiles]
    try:
        exporter['export_many'](profiles[0][0], [(p,profiles[0][1]) for p,_ in profiles])
        raise AssertionError('duplicate account UUID was accepted')
    except ValueError:
        pass
`], { encoding: 'utf8' });
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      insert into auth.users values ('${ids[0]}'), ('${ids[1]}');`);
    for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort())
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
    await db.exec(sql);
    const result = await db.query<{ user_id: string; data: { user: { name: string }; swipes: unknown[]; known: string[] } }>("select user_id,load_learner_progress(user_id,'Test')->'data' as data from learner_profiles order by user_id");
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].data.user.name, 'Learner 0');
    assert.equal(result.rows[0].data.swipes.length, 1);
    assert.deepEqual(result.rows[0].data.known, []);
    assert.equal(result.rows[1].data.user.name, 'Learner 1');
    assert.equal(result.rows[1].data.swipes.length, 0);
    assert.deepEqual(result.rows[1].data.known, ['word']);
    await db.exec(`update learner_profiles set name='New progress', version=1 where user_id='${ids[0]}';`);
    await db.exec(sql);
    const preserved = await db.query<{ name: string; version: number }>(`select name,version from learner_profiles where user_id='${ids[0]}'`);
    assert.equal(preserved.rows[0].name, 'New progress');
    assert.equal(Number(preserved.rows[0].version), 1);
    const counts = await db.query<{ n: number }>('select count(*)::int as n from learner_profiles'); assert.equal(counts.rows[0].n, 2);
  } finally { await db.close(); }
});
