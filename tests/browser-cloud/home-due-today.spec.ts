import { test, expect } from '@playwright/test';

test.use({ timezoneId: 'Europe/Zurich' });

test('garden distinguishes reviews due now from today and refreshes the counts', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
    access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'test-user', email: 'test@vocab-garden.test', user_metadata: {} },
  })));
  let dueNow = 0;
  const timeZones: (string | null)[] = [];
  await page.route('https://auth-test.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/session')) return route.fulfill({ json: {
      user: { name: 'Test', level: 'A2' }, ai_available: false,
    } });
    if (url.pathname.endsWith('/garden')) {
      timeZones.push(url.searchParams.get('time_zone'));
      return route.fulfill({ json: {
        plots: [], topics: [], bag: [],
        summary: { bag_count: 0, bag_cap: 20, planted_total: 12, due_now: dueNow, due_today: 5, upcoming_reviews: [{ date: "2026-10-22", count: 7 }, { date: "2026-10-23", count: 3 }] },
      } });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  });
  await page.goto('/#/');
  const summary = page.getByRole('region', { name: 'Learning progress' });
  await expect(summary.locator('div').filter({ has: page.getByText('Reviews due today', { exact: true }) }).locator('dd')).toHaveText('5');
  await expect(summary.locator('div').filter({ has: page.getByText('Reviews due now', { exact: true }) }).locator('dd')).toHaveText('0');
  await expect(page.getByRole('link', { name: 'Review words', exact: true })).toBeVisible();
  expect(timeZones).toEqual(['Europe/Zurich']);
  await page.screenshot({ path: 'test-results/reviews-due-today.png', fullPage: true });
  const upcomingButton = page.getByRole('button', { name: 'Upcoming reviews', exact: true });
  await upcomingButton.click();
  const dialog = page.getByRole('dialog', { name: 'Upcoming reviews' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('listitem')).toHaveCount(2);
  await expect(dialog.getByRole('listitem').first()).toHaveAccessibleName(/7 words/);
  await expect(dialog.locator('.review-forecast-bar').first()).toHaveAttribute('style', 'width: 100%;');
  await page.screenshot({ path: 'test-results/upcoming-reviews.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/upcoming-reviews-mobile.png', fullPage: true });
  await expect(dialog).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(upcomingButton).toBeFocused();
  await upcomingButton.click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).not.toBeVisible();
  dueNow = 2;
  await page.clock.fastForward(60_000);
  await expect(summary.locator('div').filter({ has: page.getByText('Reviews due now', { exact: true }) }).locator('dd')).toHaveText('2');
  await expect(page.getByRole('link', { name: 'Review words 2 due' })).toBeVisible();
});
