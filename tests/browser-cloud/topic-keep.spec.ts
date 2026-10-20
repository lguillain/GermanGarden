import { test, expect } from '@playwright/test';

const words = [
  { id: 'tree', lemma: 'Baum', article: 'der', english: 'tree', pos: 'noun', level: 'A2', status: 'new', visual_stage: 'unseen', growth: 0 },
  { id: 'flower', lemma: 'Blume', article: 'die', english: 'flower', pos: 'noun', level: 'A2', status: 'new', visual_stage: 'unseen', growth: 0 },
];
for (const outcome of ['added', 'duplicate', 'full'] as const) {
  test(`topic keep ${outcome} updates only confirmed state without waiting for unrelated refreshes`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sb-auth-test-auth-token', JSON.stringify({
      access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now()/1000)+3600,
      user: { id: 'test', email: 'test@example.com', user_metadata: {} },
    })));
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let saved = false;
    const readsAfterSave: string[] = [];
    await page.route('https://auth-test.supabase.co/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/keep')) {
        await pending;
        saved = true;
        if (outcome === 'full') return route.fulfill({status:409, json:{detail:'Your seed bag is full.'}});
        return route.fulfill({json: { added: outcome === 'added', word: { ...words[0], status: outcome === 'added' ? 'bag' : 'planted', visual_stage: outcome === 'added' ? 'seeds' : 'planted' } }});
      }
      if (route.request().method() === 'GET' && saved) readsAfterSave.push(path);
      if (path.endsWith('/session')) return route.fulfill({json:{user:{name:'Test',level:'A2'},ai_available:false}});
      if (path.endsWith('/heartbeat')) return route.fulfill({json:{today_seconds:0,total_seconds:0,current_session_seconds:0,timer_seconds:300}});
      if (path.endsWith('/practice/summary')) return route.fulfill({json:{word_count: saved && outcome === 'added' ? 1 : 0,counts:{plants:0,seeds:saved && outcome === 'added' ? 1 : 0}}});
      if (path.endsWith('/topics/home')) {
        if (saved) return; // A redundant refetch must not hold the button pending.
        return route.fulfill({json:{activity:{id:'home',name:'Home'},words}});
      }
      throw new Error(`Unexpected request ${path}`);
    });
    await page.goto('/#/practice?scope=bag');
    await expect(page.getByText('No words in this set yet.', {exact:false})).toBeVisible();
    await page.evaluate(() => { location.hash = '/topics/home'; });
    await page.getByRole('button', {name:'Add Baum to seed bag'}).click();
    try {
      await expect(page.getByRole('button', {name:'Add Baum to seed bag'})).toHaveText('Adding…');
      await expect(page.locator('.topic-words tbody tr').first()).toContainText('Unseen');
    } finally { release(); }
    if (outcome === 'full') {
      await expect(page.getByRole('alert')).toHaveText('Your seed bag is full.');
      await expect(page.getByRole('button', {name:'Add Baum to seed bag'})).toBeEnabled();
      await expect(page.locator('.topic-words tbody tr').first()).toContainText('Unseen');
    } else {
      await expect(page.getByRole('button', {name:'Add Baum to seed bag'})).toHaveCount(0);
      await expect(page.locator('.topic-words tbody tr').first()).toContainText(outcome === 'added' ? 'In seed bag' : 'Planted');
    }
    await expect(page.getByRole('button', {name:'Add Blume to seed bag'})).toBeEnabled();
    expect(readsAfterSave).toEqual([]);
    if (outcome === 'added') {
      await page.getByRole('link', {name:'Practice',exact:true}).first().click();
      await expect(page.getByRole('group',{name:'Word set'}).getByRole('link',{name:/Seeds/})).toContainText('1');
      expect(readsAfterSave).toContain('/functions/v1/garden/practice/summary');
    }
  });
}
