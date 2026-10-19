import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('SQLite export preserves Unicode, quotes, review dates, progress and time without overwriting accounts', async () => {
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
        conn.execute("INSERT INTO sessions(seconds) VALUES (42)")
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
    await db.exec(readFileSync('supabase/migrations/202610190001_garden.sql', 'utf8'));
    await db.exec(sql);
    const { rows } = await db.query<{ data: { user: { name: string }; srs: Record<string, { due_at: string; reps: number }>; swipes: { planted_at: string }[]; sessions: { seconds: number }[] } }>('select data from learner_state');
    assert.equal(rows[0].data.user.name, 'Léa');
    assert.equal(rows[0].data.srs.word.due_at, '2026-10-20T10:00:00Z');
    assert.equal(rows[0].data.srs.word.reps, 3);
    assert.equal(rows[0].data.swipes[0].planted_at, '2026-10-01T10:05:00Z');
    assert.equal(rows[0].data.sessions[0].seconds, 42);
    const words = await db.query<{ english: string }>('select english from words'); assert.equal(words.rows[0].english, "doctor's");
    await assert.rejects(db.exec(sql), /duplicate key/);
    await db.exec('ROLLBACK;');
    const count = await db.query<{ n: number }>('select count(*)::int as n from learner_state'); assert.equal(count.rows[0].n, 1);
  } finally { await db.close(); }
});
