import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Garden } from '../../supabase/functions/garden/domain.ts';
import { freshLearner, type Catalog } from '../../supabase/functions/garden/model.ts';
import { wordContext } from '../../supabase/functions/garden/word-context.ts';
import { createStore } from '../../supabase/functions/garden/store.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
const catalog: Catalog = {
  words: [{ id: 'tree', lemma: 'Baum', english: 'tree', pos: 'noun', level: 'A1' }],
  activities: [{ id: 'home', name: 'Home' }, { id: 'nature', name: 'Nature' }],
  word_activities: ['home','nature'].map(activity_id => ({ word_id: 'tree', activity_id, relevance: 1 })),
  sentences: [{ id: 1, word_id: 'tree', activity_id: 'home', text: 'Der Baum.', english: 'The tree.' }],
};
const garden = () => new Garden(catalog, freshLearner('Test'));
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${a}'),('${b}');`);
  await db.exec(readFileSync('supabase/migrations/202611050001_word_context.sql','utf8'));
  // Exercise the actual production adapter, with only its SQL transport replaced.
  const admin = {
    from: () => ({ select: () => ({ eq: (_field: string, key: string) => ({ maybeSingle: async () => {
      const rows = await db.query('select content from word_context_documents where key=$1', [key]);
      return { data: rows.rows[0], error: null };
    } }) }) }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      const values = Object.values(args);
      const params = Object.keys(args).map((key, i) => `${key} => $${i+1}`).join(',');
      const rows = await db.query<{ result: unknown }>(`select ${name}(${params}) as result`, values);
      return { data: rows.rows[0].result, error: null };
    },
  } as unknown as SupabaseClient;
  const storage = (userId: string) => createStore(admin, { userId, name: 'Test', matcher: false, scoped: null,
    measure: async (_name, operation) => operation() }).context!;
  return { db, storage };
}
test('shared introductions, private durable chats, level/topic keys, clear, retry and unchanged progress', async () => {
  const { db, storage } = await setup();
  try {
    const first = garden(), before = structuredClone(first.state);
    const prompts: string[] = [];
    const complete = async (system: string) => { prompts.push(system); return { text: 'A short explanation.' }; };
    const open = { word_id: 'tree' };
    const intro = await wordContext(open, first, storage(a), complete);
    assert.match(prompts[0], /Do not include example sentences/);
    assert.match(prompts[0], /Home/);
    assert.match(prompts[0], /A2/);
    assert.deepEqual(await wordContext(open, garden(), storage(b)), intro);
    assert.equal(prompts.length, 1);
    const send = { ...open, action: 'send', question: 'What does it mean?', request_id: 'request-1', user_id: b };
    const chat = await wordContext(send, first, storage(a), complete);
    assert.equal(chat.messages.length, 2);
    assert.deepEqual(await wordContext(send, first, storage(a), complete), chat);
    assert.equal(prompts.length, 2);
    assert.equal((await wordContext(open, first, storage(b))).messages.length, 0);
    assert.deepEqual(await wordContext(open, first, storage(a)), chat);
    first.state.user.level = 'B1';
    assert.equal((await wordContext(open, first, storage(a), complete)).messages.length, 2);
    assert.equal(prompts.length, 3);
    await wordContext({ ...open, topic: 'nature' }, first, storage(a), complete);
    assert.equal(prompts.length, 4);
    const cleared = await wordContext({ ...open, action: 'clear' }, first, storage(a));
    assert.deepEqual(cleared.messages, []);
    assert.equal(cleared.introduction, intro.introduction);
    first.state.user.level = before.user.level;
    assert.deepEqual(first.state, before);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from word_context_documents'), /permission denied/);
    await assert.rejects(db.query('select claim_word_context($1,$2,$3)', ['x', a, crypto.randomUUID()]), /permission denied/);
  } finally { await db.close(); }
});
test('database leases prevent duplicate calls and failed generation can be retried', async () => {
  const { db, storage } = await setup();
  try {
    let release!: () => void, started!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    const pending = wordContext({ word_id: 'tree' }, garden(), storage(a), async () => {
      started(); await waiting; return { text: 'Meaning.' };
    });
    await entered;
    await assert.rejects(wordContext({ word_id: 'tree' }, garden(), storage(b), async () => { throw Error('Duplicate call'); }), /being prepared/);
    release(); await pending;
    const send = { word_id: 'tree', action: 'send', question: 'Why?', request_id: 'retry' };
    await assert.rejects(wordContext(send, garden(), storage(a), async () => { throw Error('Offline'); }), /Offline/);
    assert.equal((await wordContext(send, garden(), storage(a), async () => ({ text: 'Answer.' }))).messages.length, 2);
    const key = 'lease-test', token = crypto.randomUUID();
    assert.deepEqual(await storage(a).claim(key, false, token), {});
    assert.equal(await storage(a).finish(key, false, crypto.randomUUID(), {}), false);
    assert.equal(await storage(a).claim(key, false, crypto.randomUUID()), null);
  } finally { await db.close(); }
});
