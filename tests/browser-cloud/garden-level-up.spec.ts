import { test, expect } from '@playwright/test';

for (const level of ['A1', 'A2']) {
  test(`garden suggests ${level} level-up and saves the next level`, async ({ page }, testInfo) => {
    let currentLevel = level;
    const nextLevel = level === 'A1' ? 'A2' : 'B1';
    await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
      access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'test-user', email: 'test@vocab-garden.test', user_metadata: {} },
    })));
    await page.route('https://auth-test.supabase.co/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/session')) return route.fulfill({ json: { user: { name: 'Test', level: currentLevel }, ai_available: false } });
      if (path.endsWith('/practice/weak')) return route.fulfill({ json: { words: [] } });
      if (path.endsWith('/garden')) return route.fulfill({ json: {
        plots: [], topics: [], bag: [],
        level_up: currentLevel === level ? { current_level: level, next_level: nextLevel, all_learned: level === 'A1' } : null,
        summary: { bag_count: 0, bag_cap: 20, planted_total: 120, due_now: 0, due_today: 0, found_today: 4 },
      } });
      if (path.endsWith('/level-up')) {
        expect(route.request().postDataJSON()).toEqual({ current_level: level });
        currentLevel = nextLevel;
        return route.fulfill({ json: { level: currentLevel } });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/#/');
    const suggestion = page.getByRole('region', { name: 'Level up', exact: true });
    await expect(suggestion).toContainText(`Ready for ${nextLevel}?`);
    await expect(suggestion).toContainText(level === 'A1' ? "You've learned every A1 word!" : "You've explored every A2 word in the seed bank.");
    const heading = await page.getByRole('heading', { name: 'Your garden' }).boundingBox();
    const box = await suggestion.boundingBox();
    expect(box!.x).toBeGreaterThan(heading!.x + heading!.width);
    await page.screenshot({ path: testInfo.outputPath(`garden-level-up-${level}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(suggestion).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: testInfo.outputPath(`garden-level-up-${level}-mobile.png`), fullPage: true });
    await page.getByRole('button', { name: `Level up to ${nextLevel}` }).click();
    await expect(suggestion).toHaveCount(0);
    expect(currentLevel).toBe(nextLevel);
  });
}
