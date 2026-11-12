import { expect, type Page } from '@playwright/test';

export async function revealReviewCard(page: Page) {
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
  await expect(page.locator('.word-card')).toBeVisible();
  // DE → EN nouns ask for the article first; both directions then reveal explicitly.
  const articleChoice = page.getByRole('group', { name: 'Choose the correct article' });
  if (await articleChoice.isVisible())
    await articleChoice.getByRole('button', { name: 'der', exact: true }).click();
  await page.getByRole('button', { name: /^Show (translation|answer)$/ }).click();
}
