import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogCache } from '../../supabase/functions/garden/catalog-cache.ts';

test('catalogue loads are shared, reused until expiry, and refreshed once', async () => {
  let now = 0, loads = 0;
  const get = catalogCache(async () => ({ version: ++loads }), 100, () => now);
  const [first, concurrent] = await Promise.all([get(), get()]);
  assert.equal(first, concurrent);
  now = 99;
  assert.equal(await get(), first);
  assert.equal(loads, 1);
  now = 100;
  const refreshed = await Promise.all([get(), get()]);
  assert.deepEqual(refreshed, [{ version: 2 }, { version: 2 }]);
  assert.equal(loads, 2);
});

test('a failed catalogue load can be retried', async () => {
  let loads = 0;
  const get = catalogCache(async () => {
    if (++loads === 1) throw new Error('Unavailable');
    return 'catalogue';
  });
  await assert.rejects(get(), /Unavailable/);
  assert.equal(await get(), 'catalogue');
  assert.equal(loads, 2);
});
