import { test, expect, type Page } from '@playwright/test';

function matcher(word: string) {
  return {
    card: {
      id: word,
      word_id: word,
      lemma: word,
      article: 'das',
      pos: 'noun',
      english: 'test word',
      level: 'A2',
      de: 'Ein Beispiel.',
      en: 'An example.',
      activity_id: 'home',
      activity_name: 'Home',
      sentence_id: 1,
    },
    bag: [],
  };
}
async function mockApi(page: Page, getMatcher: () => Promise<ReturnType<typeof matcher>>) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'sb-auth-test-auth-token',
      JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'test-user', email: 'test@example.test', user_metadata: {} },
      }),
    ),
  );
  let added = false;
  await page.route('https://auth-test.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/functions/v1/garden', '/api');
    let json: unknown;
    if (path === '/api/session')
      json = { user: { name: 'Test', level: 'A2' }, ai_available: false };
    else if (path === '/api/activities') json = [{ id: 'home', name: 'Home' }];
    else if (path === '/api/practice/weak') json = { words: [] };
    else if (path === '/api/garden') json = { plots: [], bag: [], topics: [] };
    else if (path === '/api/practice/summary')
      json = { word_count: 0, counts: { plants: 0, seeds: 0 } };
    else if (path === '/api/topics/home/words/example/keep') {
      added = true;
      json = {
        added: true,
        word: {
          id: 'example',
          lemma: 'Beispiel',
          article: 'das',
          english: 'example',
          level: 'A2',
          pos: 'noun',
          status: 'bag',
          visual_stage: 'seeds',
          growth: 0,
        },
      };
    } else if (path === '/api/topics/home')
      json = {
        activity: { id: 'home', name: 'Home' },
        words: [
          {
            id: 'example',
            lemma: 'Beispiel',
            article: 'das',
            english: 'example',
            level: 'A2',
            pos: 'noun',
            status: added ? 'bag' : 'new',
            visual_stage: added ? 'seeds' : 'unseen',
            growth: 0,
          },
        ],
      };
    else if (path === '/api/matcher')
      json = route.request().method() === 'GET' ? await getMatcher() : matcher('Nachfolger');
    else throw new Error(`Unexpected test request: ${path}`);
    await route.fulfill({ json });
  });
}

test('returning to Find words and reconnecting preserves the displayed card', async ({ page }) => {
  let reads = 0;
  await mockApi(page, async () => matcher(++reads === 1 ? 'Beispiel' : 'Ungewollt'));
  await page.goto('/#/matcher');
  await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Beispiel');
  await page.getByRole('link', { name: 'Practice', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Practice', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Find words', exact: true }).first().click();
  await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Beispiel');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  // Give a reconnect/remount refetch time to run; the mock responds immediately.
  await page.waitForTimeout(250);
  expect(reads).toBe(1);
  await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Beispiel');
  await page.getByRole('button', { name: 'Keep word', exact: true }).click();
  await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Nachfolger');
});

test('an invalidated selection shows loading instead of flashing an old card', async ({ page }) => {
  let reads = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockApi(page, async () => {
    if (++reads === 1) return matcher('Veraltet');
    await pending;
    return matcher('Aktuell');
  });
  await page.goto('/#/matcher');
  await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Veraltet');
  // Navigate within the SPA so the matcher cache survives, then add a word to
  // invalidate it through the same flow used by the real topic page.
  await page.evaluate(() => {
    window.location.hash = '/topics/home';
  });
  await page.getByRole('button', { name: 'Add Beispiel to seed bag', exact: true }).click();
  await expect(page.getByText('Beispiel added to your seed bag.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Find words', exact: true }).first().click();
  try {
    await expect.poll(() => reads).toBe(2);
    await expect(page.locator('.matcher-study').getByRole('status').locator('.sr-only')).toHaveText(
      'Loading…',
    );
    await expect(page.locator('.word-card')).toHaveCount(0);
    await expect(page.getByLabel('Topic', { exact: true })).toBeDisabled();
    await page.screenshot({ path: 'test-results/matcher-refresh-loading.png', fullPage: true });
  } finally {
    release();
  }
  await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Aktuell');
});
