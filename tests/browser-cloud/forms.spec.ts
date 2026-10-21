import { test, expect } from '@playwright/test';

const words = [
  { id: 'tree', word_id: 'tree', lemma: 'Baum', article: 'der', pos: 'noun', english: 'tree', level: 'A2', growth: 2, plural: 'Bäume', de: 'Der Baum ist groß.', en: 'The tree is tall.' },
  { id: 'flower', word_id: 'flower', lemma: 'Blume', article: 'die', pos: 'noun', english: 'flower', level: 'A2', growth: 1 },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
    access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'test-user', email: 'test@example.test', user_metadata: {} },
  })));
});

for (const mode of ['practice', 'recognition', 'production']) {
  test(`Forms loads on demand and preserves the ${mode} card`, async ({ page }) => {
    let optionsReads = 0;
    const writes: Record<string, unknown>[] = [];
    await page.route('https://auth-test.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      const path = url.pathname.replace('/functions/v1/garden', '');
      if (path === '/session') return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: true } });
      if (path === '/flashcards') return route.fulfill({ json: { cards: words } });
      if (path === '/activities') return route.fulfill({ json: [] });
      if (path === '/grammar/options') {
        optionsReads++;
        return route.fulfill({ json: { noun: { case: ['Nominativ', 'Dativ'], number: ['Singular', 'Plural'] } } });
      }
      if (path === '/review' && route.request().method() === 'GET') return route.fulfill({ json: {
        card: { ...words[0], track: mode, rating_options: [{ grade: 3, next_review_seconds: 86400, growth: 2 }] },
        remaining: 2, counts: { plants: 2, seeds: 0 },
      } });
      if (path === '/grammar') {
        writes.push(route.request().postDataJSON());
        return route.fulfill({ json: { expected_form: 'dem Baum', de: 'Ich sitze unter dem Baum.', en: 'I sit under the tree.' } });
      }
      throw new Error(`Unexpected request: ${route.request().method()} ${path}`);
    });
    await page.goto(mode === 'practice' ? '/#/practice/flashcards' : '/#/review');
    const card = page.locator('.word-card');
    await expect(card).toBeVisible();
    expect(optionsReads).toBe(0);
    await page.screenshot({ path: `test-results/card-${mode}.png`, fullPage: true });
    if (mode === 'practice') {
      await page.getByRole('button', { name: 'EN → DE', exact: true }).click();
      await card.getByRole('button', { name: 'Hint', exact: true }).click();
    } else {
      await expect(page.getByRole('button', { name: 'Forms', exact: true })).toHaveCount(0);
      await card.getByRole('button', { name: mode === 'production' ? 'Show answer' : 'Show translation' }).click();
    }
    if (mode === 'production') {
      await expect(card.getByRole('heading')).toHaveText('der Baum');
      await expect(card.locator('.answer-context')).toContainText('The tree is tall.');
    }
    await page.screenshot({ path: `test-results/revealed-${mode}.png`, fullPage: true });
    const before = await card.innerText();
    await page.getByRole('button', { name: 'Forms', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Forms', exact: true });
    await expect(dialog.getByRole('heading', { name: 'der Baum' })).toBeVisible();
    expect(optionsReads).toBe(1);
    expect(writes).toEqual([]);
    await dialog.getByRole('combobox', { name: 'Case', exact: true }).selectOption('Dativ');
    await dialog.getByRole('button', { name: 'Generate example' }).click();
    await expect(dialog.locator('.grammar-result')).toContainText('dem Baum');
    await dialog.getByLabel('Or write your own German sentence').fill('Ich sehe den Baum.');
    await dialog.getByRole('button', { name: 'Check sentence' }).click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes).toEqual([
      { word_id: 'tree', config: { case: 'Dativ' }, sentence: '', action: 'generate' },
      { word_id: 'tree', config: { case: 'Dativ' }, sentence: 'Ich sehe den Baum.', action: 'correct' },
    ]);
    await page.screenshot({ path: `test-results/forms-${mode}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Forms', exact: true })).toBeFocused();
    expect(await card.innerText()).toBe(before);
    await page.getByRole('button', { name: 'Forms', exact: true }).click();
    await expect(dialog.getByRole('combobox', { name: 'Case', exact: true })).toHaveValue('Dativ');
    await expect(dialog.getByLabel('Or write your own German sentence')).toHaveValue('Ich sehe den Baum.');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    if (mode === 'practice') {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await page.getByRole('button', { name: 'Forms', exact: true }).click();
      await expect(dialog.getByRole('heading', { name: 'die Blume' })).toBeVisible();
      await expect(dialog.getByRole('combobox', { name: 'Case', exact: true })).toHaveValue('Nominativ');
      await expect(dialog.getByLabel('Or write your own German sentence')).toBeEmpty();
      await expect(dialog.locator('.grammar-result')).toHaveCount(0);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(dialog).toBeInViewport();
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await page.screenshot({ path: 'test-results/forms-mobile.png', fullPage: true });
    } else {
      await expect(page.getByRole('button', { name: /Good/ })).toBeVisible();
      await expect(page.getByText('0 reviewed', { exact: true })).toBeVisible();
      await expect(page.getByText('2 to review', { exact: true })).toBeVisible();
    }
  });
}

test('old grammar links redirect to their flashcard set and Forms handles unavailable AI', async ({ page }) => {
  await page.route('https://auth-test.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/session')) return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: false } });
    if (url.pathname.endsWith('/flashcards')) {
      expect(url.searchParams.get('scope')).toBe('bag');
      expect(url.searchParams.get('topic')).toBe('home');
      return route.fulfill({ json: { cards: words } });
    }
    if (url.pathname.endsWith('/activities')) return route.fulfill({ json: [] });
    throw new Error(`Unexpected request ${url}`);
  });
  await page.goto('/#/practice/grammar?scope=bag&topic=home');
  await expect(page).toHaveURL(/practice\/flashcards\?scope=bag&topic=home/);
  await page.getByRole('button', { name: 'Forms', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('AI practice is not configured');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show translation', exact: true })).toBeVisible();
});
