import { test, expect } from '@playwright/test';

test('signed-in navigation and sign-out work while session bootstrap is stalled', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
      access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'test-user', email: 'test@vocab-garden.test', user_metadata: { name: 'Test' } },
    }));
  });
  let requested = false;
  await page.route('https://auth-test.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/functions/v1/garden/session') {
      requested = true;
      // Leave bootstrap pending until the page closes.
    } else if (url.pathname === '/auth/v1/logout') {
      await route.fulfill({ status: 204 });
    } else throw new Error(`Unexpected request: ${url.pathname}`);
  });
  await page.goto('/#/');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.locator('.profile-identity')).toContainText('Test');
  await expect(page.getByRole('status')).toHaveText('Loading…');
  expect(requested).toBe(true);
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page).toHaveURL(/#\/practice$/);
  await page.locator('.profile-button').click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
