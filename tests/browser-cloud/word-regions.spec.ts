import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/cloud-page';

for (const width of [390, 1280]) {
  test(`regional labels stay visible on cards and topic rows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, { id: 'learner', email: 'learner@example.test' });
    const word = { id: 'noun_brotli', word_id: 'noun_brotli', lemma: 'Brötli', english: 'bread roll', pos: 'noun',
      article: 'das', plural: 'Brötli', level: 'A2', regions: ['CH'], status: 'new', track: 'production',
      rating_options: [1, 2, 3, 4].map(grade => ({ grade, next_review_seconds: 86400, growth: 2 })) };
    await page.route('https://auth-test.supabase.co/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/session')) return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: false } });
      if (path.endsWith('/review/article')) return route.fulfill({ json: { card: { ...word, article_reviewed_at: '2026-01-01T00:00:00Z' }, correct: true } });
      if (path.endsWith('/review')) return route.fulfill({ json: { card: word, remaining: 1, counts: { plants: 0, seeds: 1 } } });
      if (path.endsWith('/topics/home')) return route.fulfill({ json: { activity: { id: 'home', name: 'Home' }, words: [word,
        { ...word, id: 'noun_fauteuil', lemma: 'Fauteuil', regions: ['AT', 'CH'] },
        { ...word, id: 'noun_baum', lemma: 'Baum', regions: undefined }] } });
      throw new Error(`Unexpected request ${path}`);
    });
    await page.goto('/#/review?scope=bag');
    await expect(page.locator('.word-card .word-regions')).toHaveText('Switzerland');
    await expect(page.locator('.word-card').getByRole('heading')).toHaveText('bread roll');
    await page.getByRole('group', { name: 'Choose the correct article' }).getByRole('button', { name: 'das', exact: true }).click();
    await expect(page.locator('.word-card .word-regions')).toHaveText('Switzerland');
    await page.screenshot({ path: `test-results/regional-card-${width}.png` });
    await page.goto('/#/topics/home');
    await expect(page.locator('tr').filter({ hasText: 'Brötli' }).locator('.word-regions')).toHaveText('Switzerland');
    await expect(page.locator('tr').filter({ hasText: 'Fauteuil' }).locator('.word-region')).toHaveText(['Austria', 'Switzerland']);
    await expect(page.locator('tr').filter({ hasText: 'Baum' }).locator('.word-regions')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/regional-topic-${width}.png` });
  });
}
