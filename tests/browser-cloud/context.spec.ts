import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/cloud-page';

const word = { id: 'tree', word_id: 'tree', lemma: 'Baum', article: 'der', pos: 'noun', english: 'tree', level: 'A2', growth: 2, plural: 'Bäume', de: 'Der Baum ist groß.', en: 'The tree is tall.', activity_id: 'nature' };
test.beforeEach(async ({ page }) => {
  await signIn(page);
});
for (const mode of ['practice', 'recognition', 'production']) {
  test(`Context loads on open and preserves the ${mode} card and conversation`, async ({ page }) => {
    let opens = 0;
    let fail = true;
    let messages: { role: string; content: string }[] = [];
    const requests: Record<string, unknown>[] = [];
    await page.route('https://auth-test.supabase.co/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/functions/v1/garden', '');
      if (path === '/session') return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: true } });
      if (path === '/flashcards') return route.fulfill({ json: { cards: [word] } });
      if (path === '/activities') return route.fulfill({ json: [] });
      if (path === '/review' && route.request().method() === 'GET') return route.fulfill({ json: {
        card: { ...word, track: mode, rating_options: [{ grade: 3, next_review_seconds: 86400, growth: 2 }] },
        remaining: 2, counts: { plants: 2, seeds: 0 },
      } });
      if (path === '/review/article')
        return route.fulfill({ json: { card: { ...word, track: mode, article_reviewed_at: '2026-01-01T00:00:00Z', rating_options: [{ grade: 3, next_review_seconds: 86400, growth: 2 }] }, correct: true } });
      if (path === '/context') {
        const body = route.request().postDataJSON();
        requests.push(body);
        expect(body.topic).toBe('nature');
        if (!body.action) opens++;
        if (body.action === 'send') {
          if (fail) { fail = false; return route.fulfill({ status: 502, json: { detail: 'Please retry.' } }); }
          messages = [{ role: 'user', content: body.question }, { role: 'assistant', content: 'Use the plural Bäume.' }];
        }
        if (body.action === 'clear') messages = [];
        return route.fulfill({ json: { introduction: 'Baum means tree and refers to a woody plant.', messages } });
      }
      throw new Error(`Unexpected request: ${route.request().method()} ${path}`);
    });
    await page.goto(mode === 'practice' ? '/#/practice/flashcards' : `/#/review?mode=${mode}`);
    const card = page.locator('.word-card');
    await expect(card).toBeVisible();
    expect(opens).toBe(0);
    if (mode === 'practice') await card.getByRole('button', { name: 'Hint', exact: true }).click();
    else {
      await expect(page.getByRole('button', { name: 'Context', exact: true })).toHaveCount(0);
      if (mode === 'recognition') await page.getByRole('button', { name: 'der', exact: true }).click();
      await page.getByRole('button', { name: mode === 'recognition' ? 'Show translation' : 'Show answer', exact: true }).click();
    }
    const before = await card.innerText();
    await page.getByRole('button', { name: 'Context', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Context', exact: true });
    await expect(dialog).toContainText('Baum means tree');
    expect(opens).toBe(1);
    await dialog.getByLabel('Ask about this word').fill('How about the plural?');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Context', exact: true })).toBeFocused();
    expect(await card.innerText()).toBe(before);
    await page.getByRole('button', { name: 'Context', exact: true }).click();
    await expect(dialog.getByLabel('Ask about this word')).toHaveValue('How about the plural?');
    await dialog.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(dialog).toContainText('Please retry.');
    await expect(dialog.getByLabel('Ask about this word')).toHaveValue('How about the plural?');
    await dialog.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(dialog).toContainText('Use the plural Bäume.');
    const sends = requests.filter(request => request.action === 'send');
    expect(sends[0].request_id).toBe(sends[1].request_id);
    await page.screenshot({ path: `test-results/context-${mode}.png`, fullPage: true });
    await page.reload();
    // The saved article answer survives refresh; the reveal step does not.
    if (mode !== 'practice')
      await page.getByRole('button', { name: mode === 'recognition' ? 'Show translation' : 'Show answer', exact: true }).click();
    await page.getByRole('button', { name: 'Context', exact: true }).click();
    await expect(dialog).toContainText('Use the plural Bäume.');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/context-${mode}-mobile.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Clear conversation' }).click();
    await expect(dialog).not.toContainText('Use the plural Bäume.');
    await expect(dialog).toContainText('Baum means tree');
  });
}
test('saved Context remains readable without AI and old grammar links preserve scope', async ({ page }) => {
  await page.route('https://auth-test.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/functions/v1/garden', '');
    if (path === '/session') return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: false } });
    if (path === '/flashcards') return route.fulfill({ json: { cards: [word] } });
    if (path === '/activities') return route.fulfill({ json: [] });
    if (path === '/context') {
      expect(route.request().postDataJSON().topic).toBe('nature');
      return route.fulfill({ json: { introduction: 'Saved explanation.', messages: [] } });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  await page.goto('/#/practice/grammar?scope=bag&topic=home');
  await expect(page).toHaveURL(/practice\/flashcards\?scope=bag&topic=home/);
  await page.getByRole('button', { name: 'Context', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Saved explanation.');
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
});

for (const width of [390, 1280]) {
  test(`Find words Context uses the current card topic and preserves discovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const card = { ...word, id: 'card-id', word_id: 'tree', activity_id: 'nature', activity_name: 'Nature', sentence_id: 1 };
    let opens = 0;
    await page.route('https://auth-test.supabase.co/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/functions/v1/garden', '');
      if (path === '/session') return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: true } });
      if (path === '/activities') return route.fulfill({ json: [{ id: 'home', name: 'Home' }, { id: 'nature', name: 'Nature' }] });
      if (path === '/matcher' && route.request().method() === 'GET') return route.fulfill({ json: { card, bag: [] } });
      if (path === '/context') {
        const body = route.request().postDataJSON();
        expect(body.word_id).toBe('tree');
        expect(body.topic).toBe('nature');
        opens++;
        return route.fulfill({ json: { introduction: 'Baum means tree.', messages: [{ role: 'user', content: 'A saved question' }, { role: 'assistant', content: 'A saved answer' }] } });
      }
      throw new Error(`Unexpected discovery write or request: ${path}`);
    });
    // The URL can retain an earlier topic after the matcher rotates topics.
    await page.goto('/#/matcher?topic=home');
    await expect(page.getByRole('button', { name: 'Show translation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Context', exact: true })).toHaveCount(0);
    expect(opens).toBe(0);
    await page.getByRole('button', { name: 'Show translation' }).click();
    await page.getByRole('button', { name: 'Context', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Context', exact: true });
    await expect(dialog).toContainText('Baum means tree.');
    await expect(dialog).toContainText('A saved answer');
    await page.screenshot({ path: `test-results/find-words-context-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Context', exact: true })).toBeFocused();
    await expect(page.locator('.word-card .answer-context')).toContainText('tree');
    await expect(page.getByRole('button', { name: 'Keep word', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Already learned', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Not now', exact: true })).toBeEnabled();
  });
}
