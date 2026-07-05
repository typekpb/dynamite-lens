import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('app loads and navigation works', async ({ page }) => {
    await page.goto('/');
    // App shell renders.
    await expect(page.locator('dl-root')).toBeVisible();
    // Redirects to Connections by default.
    await expect(page).toHaveURL(/\/connections/);
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();

    // Nav to PartiQL and back.
    await page.goto('/partiql');
    await expect(page.getByRole('heading', { name: 'PartiQL' })).toBeVisible();
  });
});
