import { test, expect, type Page } from '@playwright/test';
import { tracksDatabase, account } from '../helpers/review-tracks';
import { dispatch } from '../../supabase/functions/garden/service';
import { HttpError } from '../../supabase/functions/garden/model';

async function connectPage(
  page: Page,
  { catalog, store }: Pick<Awaited<ReturnType<typeof tracksDatabase>>, 'catalog' | 'store'>,
) {
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
  await page.route('https://auth-test.supabase.co/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const path = url.pathname.replace('/functions/v1/garden', '');
    if (path === '/activities') return route.fulfill({ json: catalog.activities });
    try {
      const result = await dispatch(
        path,
        request.method(),
        url.searchParams,
        request.postDataJSON() || {},
        store(),
        catalog,
      );
      await route.fulfill({ json: result });
    } catch (error) {
      await route.fulfill({
        status: error instanceof HttpError ? error.status : 500,
        json: { detail: String(error) },
      });
    }
  });
}

test('production graduates both tracks and Learned stays fully grown, unreviewable and available for practice', async ({
  page,
}) => {
  const { db, catalog, store } = await tracksDatabase();
  try {
    // Recognition is not due. Production's next Good crosses the maturity threshold.
    await db.query(
      `update learner_srs set due_at='2099-01-01', production=row(2.5,25,5,0,'review','2020-01-01',3,'2020-01-01')::review_schedule where user_id=$1 and word_id='tree'`,
      [account],
    );
    await connectPage(page, { catalog, store });
    await page.goto('/#/review');
    const card = page.locator('.word-card');
    await expect(card).toContainText('EN → DE');
    await expect(card.getByRole('heading')).toHaveText('tree');
    await expect(card).toContainText('Hint: B…');
    await expect(card).not.toContainText('Baum');
    await page.getByRole('button', { name: 'Show answer', exact: true }).click();
    await expect(card.locator('.translation')).toContainText('der Baum');
    await page.getByRole('button', { name: /^Good In/ }).click();
    await expect(page.getByRole('heading', { name: 'Fully grown: Baum' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Fully grown: Baum' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark as Learned', exact: true }).click();
    await expect(page.getByText('Session complete.', { exact: false })).toBeVisible();
    const saved = (await store().load()).data;
    expect(saved.learned).toContain('tree');
    expect(saved.srs.tree.interval_days).toBe(62.5);
    expect(saved.srs.tree.production?.interval_days).toBe(62.5);
    // Move both schedules into the past: Learned must override every due state.
    await db.query(
      `update learner_srs set due_at='2000-01-01', production.due_at='2000-01-01' where user_id=$1`,
      [account],
    );
    await page.getByRole('link', { name: 'Garden', exact: true }).click();
    await page.getByRole('button', { name: /Open Home/ }).click();
    const row = page.locator('tr').filter({ hasText: 'Baum' });
    await expect(row).toContainText('Learned');
    await expect(row.getByRole('button', { name: /Add/ })).toHaveCount(0);
    await expect(row.getByRole('link', { name: 'Review', exact: true })).toHaveCount(0);
    await expect(page.locator('.wilted')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/learned-two-tracks.png', fullPage: true });
    await page.getByRole('link', { name: 'Review', exact: true }).first().click();
    await expect(page.getByText('All caught up! No words are due for review.')).toBeVisible();
    await page.getByRole('link', { name: 'Practice', exact: true }).first().click();
    await page.getByRole('link', { name: 'Start flashcards' }).click();
    await page.getByRole('button', { name: 'EN → DE', exact: true }).click();
    await expect(page.locator('.word-card')).toBeVisible();
    if ((await page.locator('.word-card').getByRole('heading').innerText()) === 'flower')
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('.word-card').getByRole('heading')).toHaveText('tree');
    await page.getByRole('button', { name: 'Show answer' }).click();
    await expect(page.locator('.translation')).toContainText('der Baum');
    await page.getByRole('button', { name: 'DE → EN', exact: true }).click();
    await expect(page.locator('.translation')).toHaveCount(0);
    await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Baum');
    expect((await store().load()).data.reviews).toEqual([]); // History is checked directly below; snapshots omit it.
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from learner_reviews where user_id=$1',
          [account],
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    await db.close();
  }
});

test('failed production stays excluded across refresh, while recognition remains due for the next session', async ({
  page,
}) => {
  const { db, catalog, store } = await tracksDatabase();
  try {
    await connectPage(page, { catalog, store });
    const before = (await store().load()).data.srs.tree;
    await page.goto('/#/review');
    await expect(page.locator('.word-card')).toContainText('EN → DE');
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page.getByRole('button', { name: /^Again In/ }).click();
    await expect(page.getByText('Session complete.', { exact: false })).toBeVisible();
    const after = (await store().load()).data.srs.tree;
    expect(after.interval_days).toBe(before.interval_days);
    expect(after.due_at).toBe(before.due_at);
    expect(after.production?.lapses).toBe(1);
    await page.reload();
    await expect(page.getByText('Session complete.', { exact: false })).toBeVisible();
    await expect(page.locator('.word-card')).toHaveCount(0);
    await page.getByRole('link', { name: 'Garden', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your garden', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Open Home/ }).click();
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.locator('.production-flower').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/production-bud-due.png', fullPage: true });
    await page.getByRole('link', { name: 'Review', exact: true }).first().click();
    await expect(page.locator('.word-card')).toContainText('DE → EN');
    await expect(page.locator('.word-card').getByRole('heading')).toHaveText('Baum');
  } finally {
    await db.close();
  }
});
