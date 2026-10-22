import { test, expect } from '@playwright/test';

const card = (id: string) => ({ id, word_id: id, lemma: id, article: 'das', pos: 'noun', english: 'word', level: 'A2', de: 'Ein Beispiel.', en: 'An example.', activity_id: 'home', activity_name: 'Home', sentence_id: 1 });
for (const failure of [false, true]) {
  test(`next card appears during save and ${failure ? 'rolls back on failure' : 'waits for confirmation before accepting another choice'}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
      access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'test-user', email: 'test@vocab-garden.test', user_metadata: {} },
    })));
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let writes = 0;
    await page.route('https://auth-test.supabase.co/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/session')) return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: false } });
      if (path.endsWith('/activities')) return route.fulfill({ json: [] });
      if (path.endsWith('/matcher') && route.request().method() === 'GET') return route.fulfill({ json: {
        card: card('First'), bag: [], previews: { keep: { card: card('Next'), bag: [card('First')] } },
      } });
      if (path.endsWith('/matcher')) {
        writes++;
        expect(route.request().postDataJSON()).toMatchObject({ word_id: 'First', action: 'keep' });
        await pending;
        return route.fulfill(failure ? { status: 409, json: { detail: 'Progress changed. Refresh to continue.' } } : { json: { card: card('Next'), bag: [card('First')] } });
      }
      throw new Error(`Unexpected request ${path}`);
    });
    await page.goto('/#/matcher');
    await expect(page.locator('.word-card').getByRole('heading')).toHaveText('First');
    await page.getByRole('button', { name: 'Keep word', exact: true }).click();
    try {
      await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Next');
      await expect(page.getByText('Saving your choice…')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Keep word', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Not now', exact: true })).toBeDisabled();
      await expect(page.getByText('Your seed bag is empty.')).toBeVisible();
      await expect.poll(() => writes).toBe(1);
      if (!failure) await page.screenshot({ path: 'test-results/matcher-preloaded-card.png', fullPage: true });
    } finally { release(); }
    await expect(page.getByText('Saving your choice…')).toHaveCount(0);
    await expect(page.locator('.word-card').getByRole('heading')).toHaveText(failure ? 'First' : 'Next');
    if (failure) {
      await expect(page.getByRole('alert')).toContainText('Progress changed');
      await expect(page.getByText('Your seed bag is empty.')).toBeVisible();
    } else {
      await expect(page.locator('.bag-words')).toContainText('First');
      await expect(page.getByRole('button', { name: 'Keep word', exact: true })).toBeEnabled();
    }
  });
}
