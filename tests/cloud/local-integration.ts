// Run only against the dedicated local Supabase stack; never targets a hosted project.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const url = status.API_URL;
assert.ok(/^http:\/\/(127\.0\.0\.1|localhost):55321$/.test(url), 'Only this project’s local Supabase instance may be tested.');
const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const clients = [createClient(url, status.ANON_KEY, { auth: { persistSession: false } }), createClient(url, status.ANON_KEY, { auth: { persistSession: false } })];
const userIds: string[] = [];
const accounts: { email: string; password: string }[] = [];
const fixtureId = `integration-${Date.now()}`;
async function api(client: typeof admin, path: string, body?: unknown) {
  const { data } = await client.auth.getSession();
  const response = await fetch(`${url}/functions/v1/garden${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${data.session!.access_token}`, apikey: status.ANON_KEY, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result)); return result;
}
try {
  for (let i = 0; i < 2; i++) {
    const email = `${fixtureId}-${i}@vocab-garden.test`, password = crypto.randomUUID();
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error) throw result.error;
    userIds.push(result.data.user.id); accounts.push({ email, password });
    const signIn = await clients[i].auth.signInWithPassword({ email, password }); if (signIn.error) throw signIn.error;
  }
  for (const [table, data] of [
    ['words', { id: fixtureId, lemma: 'Baum', article: 'der', pos: 'noun', english: 'tree', level: 'A2' }],
    ['activities', { id: fixtureId, name: 'Test topic' }],
    ['word_activities', { word_id: fixtureId, activity_id: fixtureId, relevance: 3 }],
    ['sentences', { id: Date.now(), word_id: fixtureId, activity_id: fixtureId, text: 'Der Baum ist grün.', english: 'The tree is green.', source: 'llm' }],
  ] as const) { const { error } = await admin.from(table).insert(data); if (error) throw error; }
  const unauthenticated = await fetch(`${url}/functions/v1/garden/session`); assert.equal(unauthenticated.status, 401);
  const forged = await fetch(`${url}/functions/v1/garden/session`, { headers: { Authorization: 'Bearer invalid' } }); assert.equal(forged.status, 401);
  const crossOrigin = await fetch(`${url}/functions/v1/garden/session`, { headers: { Origin: 'https://example.org' } }); assert.equal(crossOrigin.status, 403);
  const preflight = await fetch(`${url}/functions/v1/garden/session`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } }); assert.equal(preflight.status, 204);
  await api(clients[0], '/session'); await api(clients[0], '/onboarding', { level: 'A2' });
  await api(clients[0], `/topics/${fixtureId}/words/${fixtureId}/keep`, {});
  assert.equal((await api(clients[0], '/practice?scope=bag')).words.length, 1);
  const reviewed = await api(clients[0], '/review', { word_id: fixtureId, scope: 'bag', grade: 3 });
  assert.equal(reviewed.remaining, 0); assert.equal(reviewed.card, null);
  assert.equal((await api(clients[0], '/review')).card, null);
  assert.equal((await api(clients[0], '/garden')).summary.planted_total, 1);
  assert.equal((await api(clients[1], '/garden')).summary.planted_total, 0);
  const foreign = await clients[1].from('learner_profiles').select('*').eq('user_id', userIds[0]);
  assert.deepEqual(foreign.data, []);
  const write = await clients[0].from('learner_profiles').update({ name: 'Forbidden' }).eq('user_id', userIds[0]); assert.ok(write.error);
  const rpc = await clients[0].rpc('save_learner_progress', { p_user_id: userIds[1], p_version: 0, p_changes: {} }); assert.ok(rpc.error);
  if (process.argv.includes('--browser')) {
    execFileSync('npm', ['run', 'build', '--', '--outDir', '../dist-cloud'], {
      env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY, VITE_BASE_PATH: '/garden-test/' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort', '--outDir', '../dist-cloud', '--base', '/garden-test/'], { stdio: 'ignore' });
    let browser;
    try {
      for (let i = 0; i < 50; i++) {
        try { if ((await fetch('http://127.0.0.1:4174/garden-test/')).ok) break; } catch { /* starting */ }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:4174/garden-test/#/review');
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
      await page.getByLabel('Username').fill(` ${accounts[0].email.split('@')[0].toUpperCase()} `); await page.getByLabel('Password', { exact: true }).fill(accounts[0].password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
      await page.goto('http://127.0.0.1:4174/garden-test/#/review'); await page.reload();
      await expect(page.getByText('All caught up!', { exact: false })).toBeVisible();
      await expect(page.locator('.word-card')).toHaveCount(0);
      const updated = await admin.from('learner_srs').update({ due_at: '2020-01-01T00:00:00Z' }).eq('user_id', userIds[0]).eq('word_id', fixtureId); assert.equal(updated.error, null);
      await page.reload();
      await expect(page.locator('.word-card h2')).toHaveText('Baum');
      await page.getByRole('button', { name: 'Show translation' }).click();
      await expect(page.locator('.word-card h2')).toHaveText('der Baum');
      await page.getByRole('button', { name: /^Good In/ }).click();
      await expect(page.getByText('All caught up!', { exact: false })).toBeVisible();
      await expect(page.locator('.word-card')).toHaveCount(0);
      mkdirSync('test-results', { recursive: true });
      await page.screenshot({ path: 'test-results/cloud-review-complete.png', fullPage: true });
      await page.getByRole('link', { name: 'Garden', exact: true }).click();
      await page.screenshot({ path: 'test-results/cloud-garden.png', fullPage: true });
      await page.locator('.profile-button').click();
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
      await page.getByLabel('Username').fill(accounts[0].email);
      await page.getByLabel('Password', { exact: true }).fill(accounts[0].password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
      assert.deepEqual(errors, []);
      console.log('Cloud browser checks passed: repository subpath, sign-in, page refresh, hidden articles, review completion and sign-out.');
    } finally { await browser?.close(); server.kill(); }
  }
  console.log('Local Supabase integration passed: auth, CORS, private progress, planting, practice, review completion, RLS and protected writes.');
} finally {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  await admin.from('words').delete().eq('id', fixtureId);
  await admin.from('activities').delete().eq('id', fixtureId);
}
