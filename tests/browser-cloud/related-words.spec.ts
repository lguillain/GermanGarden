import { test, expect } from '@playwright/test';

const word = (id: string, lemma: string, english: string, status = 'new', visual_stage = 'unseen') =>
  ({ id, lemma, english, pos: 'noun', level: 'A2', status, visual_stage, growth: 0 });
const related: Record<string, unknown> = {
  fahrt: { word: word('fahrt', 'Fahrt', 'journey'), family: [word('fahrkarte', 'Fahrkarte', 'ticket', 'bag', 'seeds')], together: [word('zug', 'Zug', 'train')], objects: [{ ...word('buchen', 'buchen', 'book'), pos: 'verb', object_phrase: 'eine Fahrt buchen' }] },
  buchen: { word: { ...word('buchen', 'buchen', 'book'), pos: 'verb' }, family: [], together: [], objects: [{ ...word('fahrt', 'Fahrt', 'journey'), object_phrase: 'eine Fahrt buchen' }] },
  fahrkarte: { word: word('fahrkarte', 'Fahrkarte', 'ticket', 'bag', 'seeds'), family: [word('fahrt', 'Fahrt', 'journey')], together: [] },
};

test('related words popup opens from the topic list and follows connected words', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
    access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
    user: { id: 'test', email: 'test@example.com', user_metadata: {} },
  })));
  await page.route('https://auth-test.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/session')) return route.fulfill({json:{user:{name:'Test',level:'A2'},ai_available:false}});
    if (path.endsWith('/topics/travel')) return route.fulfill({json:{activity:{id:'travel',name:'Travel'},words:[word('fahrt', 'Fahrt', 'journey')]}});
    const match = path.match(/\/words\/([^/]+)\/related$/);
    if (match && route.request().method() === 'GET') return route.fulfill({json: related[match[1]]});
    throw new Error(`Unexpected request ${path}`);
  });
  await page.goto('/#/topics/travel');
  await page.getByRole('button', { name: 'Related words for Fahrt' }).click();
  const dialog = page.getByRole('dialog', { name: /Related words/ });
  await expect(dialog.getByRole('heading').nth(1)).toHaveText('Verbs taking this object');
  await expect(dialog.getByRole('button', { name: /buchen/ })).toContainText('eine Fahrt buchen');
  await dialog.getByRole('button', { name: /buchen/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Typical objects' })).toBeVisible();
  await dialog.getByRole('button', { name: '← Fahrt' }).click();
  await expect(dialog.getByRole('heading', { name: 'Same family' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Fahrkarte/ })).toContainText('In seed bag');
  await expect(dialog.getByRole('button', { name: /Zug/ })).toBeVisible();
  await dialog.getByRole('button', { name: /Fahrkarte/ }).click();
  await expect(dialog.locator('.related-words-current')).toContainText('Fahrkarte');
  await expect(dialog.getByRole('heading', { name: 'Related by topic' })).toHaveCount(0);
  await dialog.getByRole('button', { name: '← Fahrt' }).click();
  await expect(dialog.locator('.related-words-current')).toContainText('Fahrt');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
});

test('find words offers related words once the translation is shown, without saving a choice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
    access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
    user: { id: 'test', email: 'test@example.com', user_metadata: {} },
  })));
  const card = { id: 'card-1', word_id: 'fahrt', lemma: 'Fahrt', article: 'die', pos: 'noun', english: 'journey', level: 'A2', de: 'Gute Fahrt!', en: 'Have a good trip!', activity_id: 'travel', activity_name: 'Travel', sentence_id: 1 };
  await page.route('https://auth-test.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    expect(route.request().method()).toBe('GET');
    if (path.endsWith('/session')) return route.fulfill({json:{user:{name:'Test',level:'A2'},ai_available:false}});
    if (path.endsWith('/activities')) return route.fulfill({json:[]});
    if (path.endsWith('/matcher')) return route.fulfill({json:{card, bag:[]}});
    if (path.endsWith('/words/fahrt/related')) return route.fulfill({json: related.fahrt});
    throw new Error(`Unexpected request ${path}`);
  });
  await page.goto('/#/matcher');
  await expect(page.getByRole('button', { name: 'Related words' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show translation' }).click();
  await page.getByRole('button', { name: 'Related words' }).click();
  const dialog = page.getByRole('dialog', { name: /Related words/ });
  await expect(dialog.locator('.related-words-current')).toContainText('Fahrt');
  await expect(dialog.getByRole('button', { name: /Fahrkarte/ })).toContainText('In seed bag');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Keep word', exact: true })).toBeEnabled();
});

for (const track of ['recognition', 'production']) {
  for (const article of ['die', null]) {
    test(`review offers related words after ${article ? 'article choice' : 'reveal'} in ${track}`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
        access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
        user: { id: 'test', email: 'test@example.com', user_metadata: {} },
      })));
      const card = {
        id: 'card-1', word_id: 'fahrt', lemma: 'Fahrt', article, pos: 'noun', english: 'journey', level: 'A2', track,
        rating_options: [1, 2, 3, 4].map(grade => ({ grade, next_review_seconds: 86400, growth: 1 })),
      };
      await page.route('https://auth-test.supabase.co/**', async route => {
        const path = new URL(route.request().url()).pathname;
        expect(route.request().method()).toBe('GET');
        if (path.endsWith('/session')) return route.fulfill({json:{user:{name:'Test',level:'A2'},ai_available:false}});
        if (path.endsWith('/review')) return route.fulfill({json:{card, remaining:1, counts:{plants:1,seeds:0}}});
        if (path.endsWith('/words/fahrt/related')) return route.fulfill({json:related.fahrt});
        throw new Error(`Unexpected request ${path}`);
      });
      await page.goto('/#/review');
      const trigger = page.getByRole('button', { name: 'Related words', exact: true });
      await expect(trigger).toHaveCount(0);
      await page.getByRole('button', { name: article || (track === 'production' ? 'Show answer' : 'Show translation'), exact: true }).click();
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: /Related words/ });
      await expect(dialog.locator('.related-words-current')).toContainText('Fahrt');
      await expect(dialog.getByRole('button', { name: /Fahrkarte/ })).toBeVisible();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(page.getByRole('button', { name: /^Good/ })).toBeEnabled();
      await expect(page.getByText('0 reviewed', { exact: true })).toBeVisible();
    });
  }
}

for (const guided of [false, true]) {
  for (const direction of ['recognition', 'production']) {
    test(`${guided ? 'guided' : 'standalone'} practice offers related words after ${direction} reveal`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
        access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
        user: { id: 'test', email: 'test@example.com', user_metadata: {} },
      })));
      const words = [
        { id: 'fahrt', word_id: 'fahrt', lemma: 'Fahrt', article: 'die', pos: 'noun', english: 'journey', level: 'A2', growth: 1 },
        { id: 'zug', word_id: 'zug', lemma: 'Zug', article: 'der', pos: 'noun', english: 'train', level: 'A2', growth: 1 },
      ];
      let relatedReads = 0;
      await page.route('https://auth-test.supabase.co/**', async route => {
        const path = new URL(route.request().url()).pathname.replace('/functions/v1/garden', '');
        expect(route.request().method()).toBe('GET');
        if (path === '/session') return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: true } });
        if (path === '/activities') return route.fulfill({ json: [] });
        if (path === '/practice/summary') return route.fulfill({ json: { word_count: 2, counts: { plants: 2, seeds: 0 } } });
        if (path === '/practice/weak') return route.fulfill({ json: { words } });
        if (path === '/garden') return route.fulfill({ json: { plots: [], bag: [], topics: [] } });
        if (path === '/flashcards') return route.fulfill({ json: { cards: words } });
        if (path === '/words/fahrt/related') {
          relatedReads++;
          return route.fulfill({ json: related.fahrt });
        }
        throw new Error(`Unexpected request ${path}`);
      });
      await page.goto(guided ? '/#/practice' : '/#/practice/flashcards');
      if (guided) {
        await page.getByRole('button', { name: 'Start session', exact: true }).click();
        await page.getByRole('button', { name: 'Go through flashcards' }).click();
      }
      await page.getByLabel('Flashcard direction').selectOption(direction);
      await expect(page.getByRole('button', { name: 'Related words', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Context', exact: true })).toBeVisible();
      expect(relatedReads).toBe(0);
      await page.getByRole('button', { name: direction === 'recognition' ? 'Show translation' : 'Show answer' }).click();
      const before = await page.locator('.word-card').innerText();
      await page.getByRole('button', { name: 'Related words', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: /Related words/ });
      await expect(dialog.locator('.related-words-current')).toContainText('Fahrt');
      await expect(dialog.getByRole('button', { name: /Fahrkarte/ })).toBeVisible();
      await page.screenshot({ path: `test-results/practice-related-${guided}-${direction}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Related words', exact: true })).toBeFocused();
      expect(await page.locator('.word-card').innerText()).toBe(before);
      await expect(page.getByRole('progressbar', { name: 'Flashcard progress' })).toHaveAttribute('value', '1');
      await page.getByLabel('Flashcard direction').selectOption(direction === 'recognition' ? 'production' : 'recognition');
      await expect(page.getByRole('button', { name: 'Related words', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Related words', exact: true })).toHaveCount(0);
    });
  }
}
