import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCompletion } from '../../supabase/functions/garden/anthropic.ts';

for (const [name, raw, stopReason] of [
  ['malformed', '{"de": "Ein Satz.', 'end_turn'],
  ['truncated', '{"de": "Ein Satz."}', 'max_tokens'],
  ['non-object', '[]', 'end_turn'],
]) {
  test(`completion retries ${name} output and returns the valid example`, async (t) => {
    const requests: any[] = [];
    t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(init.body as string));
      return Response.json({
        stop_reason: requests.length === 1 ? stopReason : 'end_turn',
        content: [{ type: 'text', text: requests.length === 1 ? raw : '```json\n{"de":"Mit dem Wort.","en":"With the word."}\n```' }],
      });
    });
    const result = await createCompletion('test-key')!('Generate JSON.', 'Target: Wort');
    assert.deepEqual(result, { de: 'Mit dem Wort.', en: 'With the word.' });
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0].messages, requests[1].messages);
    assert.match(requests[1].system, /valid JSON object only/);
    assert.ok(requests[1].max_tokens > requests[0].max_tokens);
  });
}

test('completion stops after two unreadable responses', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ content: [{ type: 'text', text: 'Not JSON' }] }));
  await assert.rejects(createCompletion('test-key')!('Generate JSON.', 'Target: Wort'), /unreadable response/);
  assert.equal(fetch.mock.callCount(), 2);
});

test('completion does not retry provider HTTP failures', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  await assert.rejects(createCompletion('test-key')!('Generate JSON.', 'Target: Wort'), /temporarily unavailable/);
  assert.equal(fetch.mock.callCount(), 1);
});
