import type { Page } from '@playwright/test';
import type { tracksDatabase } from './review-tracks';
import { dispatch } from '../../supabase/functions/garden/service';
import { HttpError } from '../../supabase/functions/garden/model';

export async function connectPage(
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
