import { test, expect } from '@playwright/test';

test('design reference loads without signing in or requesting learner data', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://auth-test.supabase.co/**', async route => {
    requests.push(route.request().url());
    await route.abort();
  });
  await page.goto('/#/design');
  await expect(page.getByRole('heading', { name: 'A garden of familiar elements' })).toBeVisible();
  await expect(page.locator('.design-index')).toBeVisible();
  expect(requests).toEqual([]);
});
