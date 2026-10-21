import { test, expect } from '@playwright/test';

const words = Array.from({ length: 11 }, (_, i) => ({
  id: `word-${i}`, lemma: `Wort${i}`, article: 'das', pos: 'noun', english: `word ${i}`, level: 'A2',
  de: `Das ist Wort${i}.`, en: `This is word ${i}.`, growth: 1,
  practice_reasons: [{ track: 'recognition', reason: 'Again' }],
}));
const token = (id = 'learner-a') => ({ access_token: 'test-token', refresh_token: 'refresh', token_type: 'bearer',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id, email: `${id}@example.test`, user_metadata: {} },
});

test('rounds retain five-word groups, resume activities and count coverage without rating words', async ({ page }) => {
  await page.addInitScript(value => {
    if (!localStorage.getItem('sb-auth-test-auth-token')) localStorage.setItem('sb-auth-test-auth-token', JSON.stringify(value));
  }, token());
  let candidates = words;
  let failReading = true;
  const targets: { path: string; ids: string[] }[] = [];
  await page.route('https://auth-test.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/functions/v1/garden', '');
    if (path === '/session') return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: true } });
    if (path === '/practice/summary') return route.fulfill({ json: { word_count: 11, counts: { plants: 11, seeds: 0 } } });
    if (path === '/practice/weak') return route.fulfill({ json: { words: candidates } });
    if (path === '/garden') return route.fulfill({ json: { plots: [{ id: 'home', name: 'Home', words: words.slice(0, 2) }], bag: [], topics: [] } });
    if (path === '/activities') return route.fulfill({ json: [{ id: 'home', name: 'Home' }] });
    if (path === '/reading' || path === '/chat') {
      const body = request.postDataJSON();
      targets.push({ path, ids: body.target_ids });
      const selected = words.filter(word => body.target_ids.includes(word.id));
      if (path === '/reading') {
        if (failReading) { failReading = false; return route.fulfill({ status: 502, json: { detail: 'Please retry the passage.' } }); }
        return route.fulfill({ json: { targets: selected, text: { setting: 'A garden', de: selected.map(word => word.lemma).join(' '), en: 'A passage.' } } });
      }
      return route.fulfill({ json: { targets: selected, used: [], history: body.start ? [{ role: 'assistant', content: 'Hallo!' }] : [
        ...body.history, { role: 'user', content: body.message }, { role: 'assistant', content: 'Gut!' },
      ] } });
    }
    throw new Error(`Unexpected learning request: ${request.method()} ${path}`);
  });
  await page.goto('/#/practice');
  await expect(page.getByText('3 sessions · up to 5 words each', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Topic practice', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Home, 2 planted words' }).click();
  await expect(page.locator('.practice-grid article')).toHaveCount(3);
  await page.getByRole('link', { name: '← All practice' }).click();
  await expect(page.getByRole('region', { name: 'Words needing attention' }).getByRole('link')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session 1 of 3' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Topic practice', exact: true })).toHaveCount(0);
  await expect(page.locator('.practice-round-words li')).toHaveCount(5);
  await page.getByRole('button', { name: 'Go through flashcards' }).click();
  await expect(page.locator('.word-card h2:visible')).toHaveText('Wort0');
  await page.screenshot({ path: 'test-results/practice-flashcard-activity.png', fullPage: true });
  await page.getByRole('button', { name: 'Show translation' }).click();
  await page.reload();
  await expect(page.locator('.word-card h2:visible')).toHaveText('das Wort0');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.locator('.word-card h2:visible')).toHaveText('Wort1');
  await page.getByRole('button', { name: 'Skip to activity' }).click();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish session' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/practice-reading-activity.png', fullPage: true });
  await page.getByRole('button', { name: 'Start reading' }).click();
  await expect(page.getByText('Please retry the passage.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish session' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start reading' }).click();
  await expect(page.locator('.reading')).toContainText('Wort4');
  candidates = words.slice(10); // review changes elsewhere must not reshuffle this round
  const beforeRefresh = targets.length;
  await page.reload();
  await expect(page.locator('.reading')).toContainText('Wort4');
  expect(targets.length).toBe(beforeRefresh);
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(page.getByText('2 sessions remaining to cover this round.')).toBeVisible();
  await page.getByRole('button', { name: 'Next session' }).click();
  await expect(page.getByRole('heading', { name: 'Session 2 of 3' })).toBeVisible();
  await expect(page.locator('.practice-round-words li').first()).toContainText('Wort5');
  await page.getByRole('button', { name: 'Skip to activity' }).click();
  await page.getByRole('button', { name: 'Conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Start conversation' }).click();
  await expect(page.locator('.chat-log')).toContainText('Hallo!');
  await expect(page.getByRole('button', { name: 'Finish session' })).toHaveCount(0);
  await page.getByLabel('Your reply in German').fill('Ich übe.');
  await page.reload();
  await expect(page.getByLabel('Your reply in German')).toHaveValue('Ich übe.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.chat-log')).toContainText('Gut!');
  await page.getByRole('button', { name: 'Finish session' }).click();
  await page.getByRole('button', { name: 'Next session' }).click();
  await expect(page.locator('.practice-round-words li')).toHaveCount(1);
  await expect(page.locator('.practice-round-words')).toContainText('Wort10');
  await page.getByRole('button', { name: 'Skip to activity' }).click();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await page.getByRole('button', { name: 'Start reading' }).click();
  await expect(page.locator('.reading')).toContainText('Wort10');
  await page.getByRole('button', { name: 'Finish session' }).click();
  await expect(page.getByRole('heading', { name: 'You’ve practised all 11 words this round.' })).toBeVisible();
  expect(targets.map(target => target.ids)).toEqual([
    words.slice(0, 5).map(w => w.id), words.slice(0, 5).map(w => w.id),
    words.slice(5, 10).map(w => w.id), words.slice(5, 10).map(w => w.id), ['word-10'],
  ]);
  await page.getByRole('button', { name: 'Start another round' }).click();
  await expect(page.getByRole('heading', { name: 'Session 1 of 1' })).toBeVisible();
  await page.screenshot({ path: 'test-results/weak-practice-session.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/weak-practice-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Exit round' }).click();
  await expect(page.getByRole('region', { name: 'Topic practice', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/practice-topic-garden-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Practice round' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Words needing attention' })).toHaveCount(0);
  await expect(page.locator('.practice-grid article')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/topic-practice-cards.png', fullPage: true });
  for (const [name, path] of [['Flashcards', 'flashcards'], ['Reading', 'read'], ['Conversation', 'chat']]) {
    await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', `#/practice/${path}?scope=topic&topic=home`);
  }
  await page.goto('/#/practice');
  await page.evaluate(value => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify(value)), token('learner-b'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Practice round' })).toHaveCount(0);
});

test('no weak words and AI-unavailable rounds keep ordinary practice usable', async ({ page }) => {
  await page.addInitScript(value => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify(value)), token());
  let candidates: typeof words = [];
  await page.route('https://auth-test.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/session')) return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: false } });
    if (path.endsWith('/practice/summary')) return route.fulfill({ json: { word_count: 11, counts: { plants: 11, seeds: 0 } } });
    if (path.endsWith('/practice/weak')) return route.fulfill({ json: { words: candidates } });
    if (path.endsWith('/garden')) return route.fulfill({ json: { plots: [], bag: [], topics: [] } });
    if (path.endsWith('/activities')) return route.fulfill({ json: [] });
    throw new Error(`Unexpected request ${path}`);
  });
  await page.goto('/#/practice');
  await expect(page.getByText('No words need extra attention right now.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Topic practice', exact: true })).toBeVisible();
  candidates = words.slice(0, 2);
  await page.reload();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await page.getByRole('button', { name: 'Go through flashcards' }).click();
  await expect(page.locator('.word-card')).toBeVisible();
  await page.getByRole('button', { name: 'Skip to activity' }).click();
  await expect(page.getByRole('region', { name: 'Practice round' }).getByRole('button', { name: 'Reading', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Practice round' }).getByRole('button', { name: 'Conversation', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Exit round' }).click();
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Practice round' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeVisible();
  candidates = words.slice(0, 1);
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page.locator('.practice-round-words li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Exit round' }).click();
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeVisible();
});
