import { test, expect } from '@playwright/test';
import { tracksDatabase, account } from '../helpers/review-tracks';
import { connectPage } from '../helpers/cloud-page';

for (const mode of ['recognition', 'article']) {
  test(`${mode}: article failure, separate save and completion`, async ({ page }) => {
    const {db, catalog, store} = await tracksDatabase();
    try {
      await connectPage(page, {catalog, store});
      let fail = true;
      await page.route('**/review/article', async route => {
        if (!fail) return route.fallback();
        fail = false;
        return route.fulfill({status:503, json:{detail:'Save unavailable'}});
      });
      await page.goto(mode === 'article' ? '/#/articles' : '/#/review?mode=recognition');
      const card = page.locator(mode === 'article' ? '.article-review-card' : '.word-card');
      await expect(card.getByRole('heading')).toHaveText('___ Baum');
      await page.getByRole('button', {name:'die', exact:true}).click();
      await expect(page.getByText('Save unavailable')).toBeVisible();
      expect((await store().load()).data.srs.tree.article?.last_grade).toBeNull();
      await page.getByRole('button', {name:'die', exact:true}).click();
      await expect.poll(async () => (await store().load()).data.srs.tree.article?.last_grade).toBe(1);
      if (mode === 'article') {
        // Feedback stays on the answer buttons until Articles advances on its own.
        await expect(page.getByRole('button', {name:'die, incorrect', exact:true})).toBeVisible();
        await page.screenshot({path:'test-results/article-fast-mode.png', fullPage:true});
      } else {
        await expect(card.getByRole('heading')).toHaveText('der Baum');
        await expect(card.locator('.translation')).not.toBeVisible();
        await expect.poll(() => page.evaluate(() => Object.values(sessionStorage).some(value => value.includes('articleCorrect')))).toBe(true);
        // A saved article answer survives refresh without asking again.
        await page.reload();
        await expect(page.getByRole('button', {name:'die, incorrect', exact:true})).toBeDisabled();
        await expect(page.getByRole('button', {name:'der, correct', exact:true})).toBeVisible();
        await page.getByRole('button', {name:'Show translation', exact:true}).click();
        await page.screenshot({path:'test-results/article-recognition.png', fullPage:true});
        await page.getByRole('button', {name:/^Good In/}).click();
      }
      await expect(card).toHaveCount(0);
      const state = (await store().load()).data;
      expect(state.srs.tree.article?.last_grade).toBe(1);
      if (mode === 'article') {
        expect(state.srs.tree.interval_days).toBe(25);
        expect(state.srs.tree.production?.last_grade).toBeNull();
      } else expect(state.srs.tree.last_grade).toBe(3);
      expect((await db.query<{n:number}>('select count(*)::int n from learner_reviews where user_id=$1',[account])).rows[0].n).toBe(mode === 'article' ? 1 : 2);
    } finally { await db.close(); }
  });
}

test('EN → DE asks no article and Wrong article saves production Good with article Again', async ({page}) => {
  const {db,catalog,store} = await tracksDatabase();
  try {
    await connectPage(page,{catalog,store});
    await page.goto('/#/review?mode=production');
    const card = page.locator('.word-card');
    await expect(card.getByRole('heading')).toHaveText('tree');
    await expect(page.getByRole('group',{name:'Choose the correct article'})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Wrong article'})).toHaveCount(0);
    await page.getByRole('button',{name:'Show answer',exact:true}).click();
    await expect(card.getByRole('heading')).toHaveText('der Baum');
    await page.screenshot({path:'test-results/article-production.png',fullPage:true});
    await page.getByRole('button',{name:'Wrong article'}).click();
    await expect(card).toHaveCount(0);
    const state = (await store().load()).data;
    expect(state.srs.tree.production?.last_grade).toBe(3);
    expect(state.srs.tree.article?.last_grade).toBe(1);
    expect((await db.query<{n:number}>('select count(*)::int n from learner_reviews where user_id=$1',[account])).rows[0].n).toBe(2);
  } finally { await db.close(); }
});

test('seed article save survives refresh and finishes meaning after planting', async ({page}) => {
  const {db,catalog,store} = await tracksDatabase();
  try {
    await db.query('delete from learner_srs where user_id=$1',[account]);
    await db.query('update learner_decisions set planted_at=null where user_id=$1',[account]);
    await connectPage(page,{catalog,store});
    await page.goto('/#/review?scope=bag&mode=recognition');
    await page.getByRole('button',{name:'der',exact:true}).click();
    await expect(page.getByRole('button',{name:'Show translation',exact:true})).toBeVisible();
    await page.reload();
    await page.getByRole('button',{name:'Show translation',exact:true}).click();
    await page.getByRole('button',{name:/^Good In/}).click();
    await expect(page.getByText('Your seeds are planted.',{exact:false})).toBeVisible();
    expect((await store().load()).data.srs.tree.last_grade).toBe(3);
  } finally { await db.close(); }
});


test('fast articles advances correct answers without another click', async ({page}) => {
  const {db,catalog,store} = await tracksDatabase();
  try {
    await connectPage(page,{catalog,store});
    await page.goto('/#/articles');
    await page.getByRole('button',{name:'der',exact:true}).click();
    await expect(page.getByRole('button',{name:'der, correct',exact:true})).toBeVisible();
    await expect(page.locator('.article-review-card')).toHaveCount(0);
    expect((await store().load()).data.srs.tree.article?.last_grade).toBe(3);
  } finally { await db.close(); }
});
