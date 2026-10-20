import { test, expect } from '@playwright/test';

test('farmer signs out only this session and allows signing back in or switching accounts', async ({ page }) => {
  const logoutScopes: (string | null)[] = [];
  let username = '';
  const time = { today_seconds: 0, total_seconds: 0, current_session_seconds: 0, timer_seconds: 300 };
  await page.route('https://auth-test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === '/auth/v1/token') {
      const body = request.postDataJSON();
      expect(body.password).toBe('test-password');
      username = body.email.split('@')[0];
      const payload = { sub: username, exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url'), 'signature'].join('.');
      await route.fulfill({ json: {
        access_token: token, refresh_token: `refresh-${username}`, token_type: 'bearer', expires_in: 3600,
        user: { id: username, email: body.email, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      } });
    } else if (url.pathname === '/auth/v1/logout') {
      logoutScopes.push(url.searchParams.get('scope'));
      await route.fulfill({ status: 204 });
    } else if (url.pathname === '/functions/v1/garden/session') {
      await route.fulfill({ json: { user: { name: username, level: 'A2', swipes: 0 }, ai_available: false, activities: [] } });
    } else if (url.pathname === '/functions/v1/garden/heartbeat') {
      await route.fulfill({ json: time });
    } else if (url.pathname === '/functions/v1/garden/garden') {
      await route.fulfill({ json: { plots: [], topics: [], bag: [], summary: { bag_count: 0, bag_cap: 20, due_now: 0, planted_total: 0, time } } });
    } else {
      throw new Error(`Unexpected request: ${url.pathname}`);
    }
  });
  await page.goto('/#/profile');
  for (const name of ['first', 'first', 'second']) {
    await page.getByLabel('Username', { exact: true }).fill(name);
    await page.getByLabel('Password', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your garden', exact: true })).toBeVisible();
    await expect(page.locator('.profile-identity')).toContainText(name);
    await page.locator('.profile-button').click();
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('sb-auth-test-auth-token'))).toBeNull();
  }
  expect(logoutScopes).toEqual(['local', 'local', 'local']);
});
