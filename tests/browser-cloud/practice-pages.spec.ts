import { test, expect } from '@playwright/test';

const words = [
  { id: 'tree', lemma: 'Baum', article: 'der', pos: 'noun', english: 'tree', level: 'A2' },
  { id: 'flower', lemma: 'Blume', article: 'die', pos: 'noun', english: 'flower', level: 'A2' },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'sb-auth-test-auth-token',
      JSON.stringify({
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'test-user', email: 'test@vocab-garden.test', user_metadata: {} },
      }),
    ),
  );
  await page.route('https://auth-test.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/session'))
      return route.fulfill({
        json: {
          user: { name: 'Test', level: 'A2' },
          ai_available: true,
        },
      });
    if (path.endsWith('/practice/summary')) return route.fulfill({ json: { word_count: words.length, counts: { plants: 2, seeds: 0 } } });
    if (path.endsWith('/activities')) return route.fulfill({ json: [] });
    if (path.endsWith('/practice'))
      return route.fulfill({
        json: {
          words,
          counts: { plants: 2, seeds: 0 },
          grammar_options: {
            noun: { case: ['Nominativ', 'Dativ'], number: ['Singular', 'Plural'] },
          },
        },
      });
    throw new Error(`Unexpected request ${path}`);
  });
});

for (const mode of ['chat', 'read', 'grammar']) {
  test(`${mode} handles delayed and empty practice data without rendering errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(mode === 'grammar' ? '**/functions/v1/garden/practice?*' : '**/functions/v1/garden/practice/summary?*', async (route) => {
      await pending;
      await route.fulfill({
        json: { word_count: 0, words: [], counts: { plants: 0, seeds: 0 }, grammar_options: {} },
      });
    });
    await page.goto(`/#/practice/${mode}?scope=bag`);
    try {
      await expect(page.getByRole('status')).toContainText('Loading');
    } finally {
      release();
    }
    await expect(page.getByText('No words in this practice set yet.')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('practice pages keep their own state and reset it when the word set changes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  for (const path of ['chat', 'reading', 'grammar']) {
    await page.route(`**/functions/v1/garden/${path}`, async (route) => {
      const body = route.request().postDataJSON();
      requests.push({ path, body });
      if (path === 'reading')
        return route.fulfill({
          json: {
            targets: words,
            text: { setting: 'A garden', de: 'Der Baum ist grün.', en: 'The tree is green.' },
          },
        });
      if (path === 'chat')
        return route.fulfill({
          json: {
            targets: words,
            used: body.message ? ['Baum'] : [],
            history: body.message
              ? [
                  { role: 'user', content: body.message },
                  { role: 'assistant', content: 'Sehr schön!' },
                ]
              : [{ role: 'assistant', content: 'Was wächst im Garten?' }],
          },
        });
      return route.fulfill({
        json: {
          expected_form: 'dem Baum',
          de: 'Unter dem Baum.',
          en: 'Under the tree.',
          focus: 'Dative form.',
        },
      });
    });
  }
  await page.goto('/#/practice?scope=bag');
  await page.getByRole('link', { name: 'Start reading' }).click();
  await page.getByRole('button', { name: 'Start reading' }).click();
  await expect(page.locator('.reading')).toContainText('Der Baum ist grün.');
  await expect(page.locator('.chips .badge')).toHaveText(['der Baum', 'die Blume']);
  await expect(page.locator('.chips .used')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show English translation' }).click();
  await expect(page.locator('.reading .translation')).toHaveText('The tree is green.');
  await page.getByRole('link', { name: '← Practice', exact: true }).click();
  await page.getByRole('link', { name: 'Start conversation' }).click();
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page.locator('.chat-log')).toContainText('Was wächst im Garten?');
  await expect(page.locator('.chips .badge')).toHaveText(['der Baum', 'die Blume']);
  await expect(page.locator('.chips .used')).toHaveCount(0);
  await page.getByLabel('Your reply in German').fill('Der Baum ist schön.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.chat-log')).toContainText('Sehr schön!');
  await expect(page.locator('.chips .used')).toHaveText(['der Baum ✓']);
  await page.evaluate(() => {
    window.location.hash = '/practice/chat?scope=all';
  });
  await expect(page.getByRole('button', { name: 'Start conversation' })).toBeVisible();
  await expect(page.locator('.chat-log')).toHaveCount(0);
  await page.getByRole('link', { name: '← Practice', exact: true }).click();
  await page.getByRole('link', { name: 'Start grammar playground' }).click();
  await page.getByRole('combobox', { name: 'Case', exact: true }).selectOption('Dativ');
  await page.getByRole('button', { name: 'Generate example' }).click();
  await expect(page.locator('.grammar-result')).toContainText('dem Baum');
  await page.locator('.grammar-word-list button').nth(1).click();
  await expect(page.locator('.grammar-result')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Case', exact: true })).toHaveValue('Nominativ');
  expect(requests.find((request) => request.path === 'reading')?.body).toMatchObject({
    scope: 'bag',
  });
  expect(requests.find((request) => request.path === 'grammar')?.body).toMatchObject({
    word_id: 'tree',
    config: { case: 'Dativ' },
  });
  expect(errors).toEqual([]);
});

for (const path of ['/practice', '/practice/read', '/practice/chat']) {
  test(`${path} starts a counts-only request before session completes and reuses it`, async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let summaryReads = 0;
    const unexpected: string[] = [];
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/garden/practice') || pathname.endsWith('/activities')) unexpected.push(pathname);
    });
    await page.route('**/functions/v1/garden/session', async route => {
      await pending;
      await route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: true } });
    });
    await page.route('**/functions/v1/garden/practice/summary?*', async route => {
      summaryReads++;
      await route.fulfill({ json: { word_count: 2, counts: { plants: 2, seeds: 0 } } });
    });
    await page.goto(`/#${path}`);
    try {
      await expect.poll(() => summaryReads).toBe(1);
      await expect(page.getByRole('heading', { name: path === '/practice' ? 'Practice' : path.endsWith('/read') ? 'Reading' : 'Conversation', exact: true })).toBeVisible();
      if (path === '/practice') await expect(page.getByRole('link', { name: 'Start flashcards' })).toBeVisible();
      else await expect(page.getByRole('link', { name: '← Practice', exact: true })).toBeVisible();
    } finally { release(); }
    await expect(page.getByRole('heading', { name: path === '/practice' ? 'Practice' : path.endsWith('/read') ? 'Reading' : 'Conversation', exact: true })).toBeVisible();
    expect(summaryReads).toBe(1);
    expect(unexpected).toEqual([]);
  });
}
