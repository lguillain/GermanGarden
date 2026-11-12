import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/cloud-page';

const counts = { unseen: 1, skipped: 0, seeds: 0, planted: 0, due: 0, grown: 0 };

test.beforeEach(async ({ page }) => {
  await signIn(page, { email: 'test@vocab-garden.test' });
  await page.route('**/functions/v1/garden/practice/weak?*', route => route.fulfill({ json: { words: [] } }));
  await page.route('https://auth-test.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/session')) return route.fulfill({ json: { user: { name: 'Test', level: 'A2' }, ai_available: true } });
    if (path.endsWith('/activities')) return route.fulfill({ json: [{ id: 'home', name: 'Home' }] });
    throw new Error(`Unexpected request ${path}`);
  });
});

test('Explore search stays editable while topics load and filters the arriving data', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/functions/v1/garden/garden*', async route => {
    await pending;
    await route.fulfill({ json: { topics: [{ id: 'home', name: 'Home', overview: counts }, { id: 'work', name: 'Work', overview: counts }] } });
  });
  await page.goto('/#/explore');
  try {
    await expect(page.getByRole('heading', { name: 'Explore more topics' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Find a topic to explore' }).fill('work');
    await expect(page.getByRole('status').locator('.sr-only')).toHaveText('Loading…');
    await expect(page.getByText('No topics match your search.')).toHaveCount(0);
  } finally { release(); }
  await expect(page.locator('.topic-row')).toHaveCount(1);
  await expect(page.locator('.topic-row')).toContainText('Work');
});

test('Topic navigation and filters stay usable while its words load', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/functions/v1/garden/session', async () => {});
  await page.route('**/functions/v1/garden/topics/home', async route => {
    await pending;
    await route.fulfill({ json: { activity: { id: 'home', name: 'Home' }, words: [
      { id: 'tree', lemma: 'Baum', english: 'tree', level: 'A2', pos: 'noun', status: 'new' },
      { id: 'flower', lemma: 'Blume', english: 'flower', level: 'A2', pos: 'noun', status: 'new' },
    ] } });
  });
  await page.goto('/#/topics/home');
  try {
    await expect(page.getByRole('link', { name: '← Explore topics' })).toBeVisible();
    await expect(page.getByRole('link', { name: '← Garden' })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Search words' }).fill('Baum');
    await page.getByRole('combobox', { name: 'Word status' }).selectOption('new');
    await page.getByRole('checkbox', { name: 'Show other levels' }).check();
    await expect(page.getByText('No words match this view.')).toHaveCount(0);
  } finally { release(); }
  await expect(page.locator('.topic-words tbody tr')).toHaveCount(1);
  await expect(page.locator('.topic-words tbody')).toContainText('Baum');
});

test('Practice mode links work while counts are pending', async ({ page }) => {
  await page.route('**/functions/v1/garden/practice/summary?*', async () => {});
  await page.route('**/functions/v1/garden/flashcards?*', route => route.fulfill({ json: { cards: [] } }));
  await page.goto('/#/practice?scope=topic&topic=home');
  await expect(page.getByRole('status').locator('.sr-only')).toHaveText('Loading…');
  await expect(page.getByRole('link', { name: 'Reading', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Flashcards', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Flashcards' })).toBeVisible();
  await expect(page.getByText('No words in this deck yet.')).toBeVisible();
});

test('Home actions survive session and garden failures', async ({ page }) => {
  await page.route('**/functions/v1/garden/session', route => route.fulfill({ status: 500, json: { detail: 'Profile unavailable' } }));
  await page.route('**/functions/v1/garden/garden*', route => route.fulfill({ status: 500, json: { detail: 'Garden unavailable' } }));
  await page.route('**/functions/v1/garden/practice/summary?*', route => route.fulfill({ status: 500, json: { detail: 'Counts unavailable' } }));
  await page.goto('/#/');
  await expect(page.getByText('Profile unavailable')).toBeVisible();
  await expect(page.getByText('Garden unavailable')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Find new words', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Topic practice', exact: true })).toBeVisible();
  await expect(page.getByText('Counts unavailable')).toBeVisible();
});

test('Matcher guidance drafts and seed bag navigation remain usable while a card loads', async ({ page }) => {
  await page.route('**/functions/v1/garden/matcher?*', async () => {});
  await page.goto('/#/matcher');
  await page.getByText('Help me choose a topic', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Where will you use German?' }).fill('At the doctor');
  await expect(page.getByRole('textbox', { name: 'Where will you use German?' })).toHaveValue('At the doctor');
  await expect(page.getByRole('button', { name: 'Match a topic', exact: true })).toBeDisabled();
  await expect(page.getByRole('complementary', { name: 'Seed bag' }).getByRole('link', { name: 'Practice' })).toBeVisible();
  await expect(page.getByText('Your seed bag is empty.')).toHaveCount(0);
});

test.beforeEach(async ({ page }) => {
  await page.route('**/functions/v1/garden/practice/weak?*', route => route.fulfill({ json: { words: [] } }));
});

test('Explore shows overall level progress independently of topic search', async ({ page }) => {
  await page.route('**/functions/v1/garden/garden*', route => route.fulfill({ json: {
    level_progress: { level: 'A2', overview: { unseen: 50, skipped: 10, seeds: 5, planted: 10, due: 5, grown: 20 } },
    topics: [{ id: 'home', name: 'Home', overview: counts }, { id: 'work', name: 'Work', overview: counts }],
  } }));
  await page.goto('/#/explore');
  const progress = page.getByRole('region', { name: 'Overall level progress' });
  await expect(progress.getByRole('heading', { name: 'A2 progress' })).toBeVisible();
  await expect(progress).toContainText('20 of 100 words grown or learned');
  await expect(progress.getByRole('img')).toHaveAttribute('aria-label', 'Unseen: 50 words, Skipped / Not now: 10 words, Seeds: 5 words, Planted: 10 words, Review due: 5 words, Grown / Learned: 20 words');
  await page.screenshot({ path: 'test-results/explore-level-progress.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Find a topic to explore' }).fill('missing');
  await expect(page.getByText('No topics match your search.')).toBeVisible();
  await expect(progress).toContainText('20 of 100 words grown or learned');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(progress).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
