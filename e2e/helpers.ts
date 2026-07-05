import { Page, expect } from '@playwright/test';

/**
 * Creates a "Local" DynamoDB connection profile (via the bundled `/local`
 * proxy), tests it, and connects — landing on the Tables page.
 */
export async function connectLocal(page: Page, name = 'e2e-local'): Promise<void> {
  // Start from a clean slate so re-runs don't accumulate duplicate profiles.
  await page.goto('/connections');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('new-profile').click();

  await page.getByTestId('conn-name').fill(name);
  await page.getByTestId('conn-mode').selectOption('local');
  await page.getByTestId('conn-endpoint').fill('/local');
  await page.getByTestId('conn-region').fill('us-east-1');
  await page.getByTestId('conn-accesskey').fill('local');
  await page.getByTestId('conn-secretkey').fill('local');

  // Test the connection against DynamoDB Local via the proxy.
  await page.getByRole('button', { name: 'Test' }).click();
  await expect(page.getByText(/Connected —/)).toBeVisible({ timeout: 20_000 });

  // Save the profile, then activate it via the row "Connect" button.
  await page.getByRole('button', { name: 'Save' }).click();
  const row = page.locator('.profile-row', { hasText: name });
  await row.getByRole('button', { name: 'Connect' }).click();

  await expect(page).toHaveURL(/\/tables/);
}

/** Unique table name so parallel/re-runs don't collide. */
export function uniqueTableName(prefix = 'E2E'): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
}
