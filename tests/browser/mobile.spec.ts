import { test, expect, type Page } from '@playwright/test';

test.use({ hasTouch: true });

async function fitsScreen(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

for (const width of [320, 390, 768]) {
  test(`study flows fit a ${width}px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByLabel('New learner').fill(`Mobile ${width}`);
    await page.getByRole('button', { name: 'Create profile' }).click();
    await page.getByLabel('A2 — basic').check();
    await page.getByRole('button', { name: 'Start learning' }).click();
    await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
    await fitsScreen(page);
    if (width <= 760) {
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
    }
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Find words', exact: true })
      .click();
    await expect(page.locator('.word-card')).toBeVisible();
    if (width <= 760) {
      await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      await page.getByRole('button', { name: /^Topic:/ }).click();
      await expect(page.getByLabel('Topic', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: /^Topic:/ }).click();
    }
    await page.getByRole('button', { name: 'Keep word' }).click();
    const bag = page.getByRole('complementary', { name: 'Seed bag', exact: true });
    if (width <= 760) await bag.getByRole('button', { name: /^Seed bag/ }).click();
    await expect(bag).toContainText('1 / 20');
    await fitsScreen(page);
    await bag.getByRole('link', { name: 'Plant', exact: true }).click();
    await page.getByRole('button', { name: 'Show translation' }).click();
    await expect(page.locator('.grade-actions button')).toHaveCount(4);
    await fitsScreen(page);
    await page.screenshot({ path: `test-results/mobile-review-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /^Again In .* Plants seed$/ }).click();
    await expect(page.getByText('Your seeds are planted.')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
    if (width <= 760) {
      await page.locator('.mobile-garden-topics a').first().click();
    } else {
      await page
        .getByRole('button', { name: /^Open .+ planted words$/ })
        .first()
        .click();
    }
    await expect(page.locator('.topic-words tbody tr').first()).toBeVisible();
    await fitsScreen(page);
    await page.getByRole('button', { name: /^Meaning/ }).click();
    await page.screenshot({ path: `test-results/mobile-topic-${width}.png`, fullPage: true });
    // Enable AI layouts without contacting an AI provider; only inspect their initial UI.
    await page.route('**/api/session', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ json: { ...(await response.json()), ai_available: true } });
    });
    for (const route of [
      '/explore',
      '/practice',
      '/practice/flashcards',
      '/practice/grammar',
      '/practice/chat',
      '/practice/read',
    ]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
      await fitsScreen(page);
    }
  });
}
