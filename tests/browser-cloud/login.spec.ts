import { test, expect } from '@playwright/test';

test('sign-in submits the visible values when autofill does not dispatch input events', async ({ page }) => {
  await page.route('https://auth-test.supabase.co/auth/v1/token**', route =>
    route.fulfill({ status: 400, json: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } }));
  await page.goto('/#/profile');
  // Simulate autofill updating DOM values without notifying React.
  await page.getByLabel('Username', { exact: true }).evaluate((input: HTMLInputElement) => { input.value = 'leo'; });
  await page.getByLabel('Password', { exact: true }).evaluate((input: HTMLInputElement) => { input.value = 'test-password'; });
  const submitted = page.waitForRequest('**/auth/v1/token?grant_type=password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await submitted).postDataJSON()).toMatchObject({
    email: 'leo@vocab-garden.test', password: 'test-password',
  });
});

test('farmer signs out only this session and allows signing back in or switching accounts', async ({ page }) => {
  const logoutScopes: (string | null)[] = [];
  let username = '';
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
      await route.fulfill({ json: { user: { name: username, level: 'A2' }, ai_available: false } });
    } else if (url.pathname === '/functions/v1/garden/practice/weak') {
      await route.fulfill({ json: { words: [] } });
    } else if (url.pathname === '/functions/v1/garden/garden') {
      await route.fulfill({ json: { plots: [], topics: [], bag: [], summary: { bag_count: 0, bag_cap: 20, due_now: 0, planted_total: 0 } } });
    } else {
      throw new Error(`Unexpected request: ${url.pathname}`);
    }
  });
  await page.goto('/#/profile');
  for (const [index, name] of ['first', 'first', 'second'].entries()) {
    if (index === 1) {
      // Re-login after farmer logout with autofill that emits no change events.
      await page.getByLabel('Username', { exact: true }).evaluate((input: HTMLInputElement, value) => { input.value = value; }, name);
      await page.getByLabel('Password', { exact: true }).evaluate((input: HTMLInputElement) => { input.value = 'test-password'; });
    } else {
      await page.getByLabel('Username', { exact: true }).fill(name);
      await page.getByLabel('Password', { exact: true }).fill('test-password');
    }
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your garden', exact: true })).toBeVisible();
    await expect(page.locator('.profile-identity')).toContainText(name);
    await page.locator('.profile-button').click();
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('sb-auth-test-auth-token'))).toBeNull();
  }
  expect(logoutScopes).toEqual(['local', 'local', 'local']);
});

for (const expired of [false, true]) {
  test(`reopening the saved sign-in URL restores a ${expired ? 'refreshed' : 'valid'} session`, async ({ page }) => {
    await page.addInitScript((expired) => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
      access_token: 'saved-token', refresh_token: 'saved-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
      user: { id: 'test', email: 'test@vocab-garden.test', user_metadata: {} },
    })), expired);
    let refreshes = 0;
    let sessionRequests = 0;
    await page.route('https://auth-test.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/auth/v1/token') {
        expect(url.searchParams.get('grant_type')).toBe('refresh_token');
        refreshes++;
        return route.fulfill({ json: {
          access_token: 'refreshed-token', refresh_token: 'new-refresh', token_type: 'bearer', expires_in: 3600,
          user: { id: 'test', email: 'test@vocab-garden.test', user_metadata: {} },
        } });
      }
      if (url.pathname.endsWith('/session')) { sessionRequests++; return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: false } }); }
      if (url.pathname.endsWith('/practice/weak')) return route.fulfill({ json: { words: [] } });
      if (url.pathname.endsWith('/garden')) return route.fulfill({ json: { plots: [], topics: [], bag: [], summary: { bag_count: 0, bag_cap: 20, due_now: 0, planted_total: 0 } } });
      throw new Error(`Unexpected request ${url.pathname}`);
    });
    await page.goto('/#/profile');
    await expect(page.getByRole('heading', { name: 'Your garden', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
    expect(refreshes).toBe(expired ? 1 : 0);
    expect(sessionRequests).toBe(1);
  });
}

test('a rejected saved session shows sign-in without redirecting in a loop', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
    access_token: 'saved-token', refresh_token: 'saved-refresh', token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'test', email: 'test@vocab-garden.test', user_metadata: {} },
  })));
  await page.route('**/functions/v1/garden/**', route => route.fulfill({ status: 401, json: { detail: 'Please sign in.' } }));
  await page.goto('/#/profile');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/profile$/);
});
