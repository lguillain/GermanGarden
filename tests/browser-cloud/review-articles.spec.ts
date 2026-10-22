import { test, expect } from '@playwright/test';

for (const track of ['recognition', 'production']) {
  for (const correct of [true, false]) {
    test(`${track} noun article ${correct ? 'allows self-rating' : 'reveals without automatic grading'}`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
        access_token: 'test-token', refresh_token: 'refresh', token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'learner', email: 'learner@example.test', user_metadata: {} },
      })));
      const writes: Record<string, unknown>[] = [];
      const card = { id: 'tree', word_id: 'tree', lemma: 'Baum', english: 'tree', pos: 'noun', article: 'der', plural: 'Bäume', de: 'Der Baum ist groß.', level: 'A2', track,
        rating_options: [1, 2, 3, 4].map(grade => ({ grade, next_review_seconds: 86400, growth: 2 })),
      };
      await page.route('https://auth-test.supabase.co/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (path.endsWith('/session')) return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: false } });
        if (path.endsWith('/review') && request.method() === 'GET') return route.fulfill({ json: { card, remaining: 1, counts: { plants: 0, seeds: 1 } } });
        if (path.endsWith('/review')) {
          writes.push(request.postDataJSON());
          if (!correct && writes.length === 1) return route.fulfill({ status: 503, json: { detail: 'Save unavailable' } });
          return route.fulfill({ json: { card: null, remaining: 0, counts: { plants: 1, seeds: 0 } } });
        }
        throw new Error(`Unexpected request ${path}`);
      });
      await page.goto('/#/review?scope=bag');
      const choice = page.getByRole('group', { name: 'Choose the correct article' });
      await expect(choice.getByRole('button')).toHaveCount(3);
      await expect(page.locator('.word-card').getByRole('heading')).toHaveText(track === 'recognition' ? '___ Baum' : 'tree');
      await expect(page.locator('.word-card').getByRole('group', { name: 'Choose the correct article' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Show answer|Show translation|Hint/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /^Good In/ })).toHaveCount(0);
      await page.screenshot({ path: `test-results/review-article-${track}.png`, fullPage: true });
      await choice.getByRole('button', { name: correct ? 'der' : 'die', exact: true }).click();
      expect(writes).toEqual([]);
      await expect(page.locator('.word-card').getByRole('heading')).toHaveText('der Baum');
      await expect(page.locator('.word-card').getByRole('status')).toHaveCount(0);
      await expect(page.getByText('0 reviewed', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^Good In/ }).click();
      if (!correct) {
        await expect(page.getByText('Save unavailable')).toBeVisible();
        await expect(page.locator('.word-card').getByRole('heading')).toHaveText('der Baum');
        await page.getByRole('button', { name: /^Good In/ }).click();
      }
      await expect(page.getByText('Your seeds are planted.', { exact: false })).toBeVisible();
      expect(writes).toHaveLength(correct ? 1 : 2);
      for (const write of writes) expect(write).toMatchObject({ word_id: 'tree', grade: 3, track, scope: 'bag', excluded: [] });
      await expect(page.getByText('1 reviewed', { exact: true })).toBeVisible();
    });
  }
}
