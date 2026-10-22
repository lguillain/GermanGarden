import { test, expect } from '@playwright/test';
import { tracksDatabase, otherAccount } from '../helpers/review-tracks';
import { connectPage } from '../helpers/cloud-page';
import { revealReviewCard } from '../helpers/study';

for (const width of [320, 390, 768, 1440]) {
  test(`discover, practise, plant and revisit a topic at ${width}px`, async ({ page }) => {
    const { db, catalog, store } = await tracksDatabase();
    try {
      const learnerStore = store(otherAccount);
      const initial = await learnerStore.load();
      initial.data.user.level = 'A2';
      await learnerStore.save(initial.version, initial.data);
      await connectPage(page, { catalog, store: () => store(otherAccount) });
      await page.setViewportSize({ width, height: 1000 });
      const fitsScreen = async () =>
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      await page.goto('/#/');
      await expect(page.getByRole('heading', { name: 'Your garden' })).toBeVisible();
      await fitsScreen();
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
      await page.getByRole('button', { name: 'Show translation' }).click();
      const word = await page.locator('.word-card').getByRole('heading').innerText();
      await page.getByRole('button', { name: 'Keep word' }).click();
      const bag = page.getByRole('complementary', { name: 'Seed bag', exact: true });
      if (width <= 760) await bag.getByRole('button', { name: /^Seed bag/ }).click();
      await expect(bag).toContainText('1 / 20');
      await expect(bag).toContainText(word);
      await fitsScreen();
      await bag.getByRole('link', { name: 'Practice', exact: true }).click();
      await page.getByRole('link', { name: 'Flashcards', exact: true }).click();
      const beforePractice = (await store(otherAccount).load()).data;
      await page.getByRole('button', { name: 'Show translation' }).click();
      await expect(page.locator('.word-card').getByRole('heading')).toHaveText(word);
      await fitsScreen();
      await page.getByRole('button', { name: 'Finish deck' }).click();
      await expect(page.getByRole('heading', { name: 'Deck complete' })).toBeVisible();
      expect((await store(otherAccount).load()).data).toEqual(beforePractice);
      await page.getByRole('link', { name: 'German Garden', exact: true }).click();
      await page.getByRole('button', { name: 'Seed bag 1 / 20', exact: true }).click();
      await page
        .getByRole('dialog', { name: 'Seed bag' })
        .getByRole('link', { name: 'Plant', exact: true })
        .click();
      await revealReviewCard(page);
      await expect(page.locator('.grade-actions button')).toHaveCount(4);
      await fitsScreen();
      await page.getByRole('button', { name: /^Good In .* Plants seed$/ }).click();
      await expect(page.getByText('Your seeds are planted.', { exact: false })).toBeVisible();
      await expect(page.getByText('1 reviewed', { exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'German Garden', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Seed bag 0 / 20', exact: true }),
      ).toBeVisible();
      if (width <= 760) await page.locator('.mobile-garden-topics a').first().click();
      else await page.getByRole('button', { name: /^Open Home/ }).click();
      await expect(page.locator('.topic-words')).toContainText(word);
      await page.getByRole('button', { name: /^Meaning/ }).click();
      await fitsScreen();
      await page.reload();
      await expect(page.locator('.topic-scene')).toBeVisible();
      await expect(page.locator('.topic-words')).toContainText(word);
      await page.screenshot({ path: `test-results/learning-flow-${width}.png`, fullPage: true });
    } finally {
      await db.close();
    }
  });
}
