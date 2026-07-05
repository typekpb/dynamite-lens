import { test, expect } from '@playwright/test';
import { connectLocal, uniqueTableName } from './helpers';

/**
 * End-to-end happy path against DynamoDB Local (proxied via `/local`):
 *   connect → create table → add item → scan → verify → PartiQL SELECT.
 *
 * Requires the docker-compose stack (web + dynamodb-local) to be running,
 * or any equivalent instance reachable at BASE_URL.
 */
test.describe('DynamoDB CRUD flow (local)', () => {
  const tableName = uniqueTableName();

  test('create table, add & query an item, then PartiQL', async ({ page }) => {
    await connectLocal(page);

    // --- Create a table (pk: String) ---
    await page.getByTestId('open-create').click();
    await page.getByTestId('ct-name').fill(tableName);
    await page.getByTestId('ct-pk').fill('pk');
    await page.getByTestId('ct-submit').click();

    // Table appears in the list.
    const tableLink = page.getByTestId('table-link').filter({ hasText: tableName });
    await expect(tableLink).toBeVisible({ timeout: 15_000 });

    // --- Open table detail ---
    await tableLink.click();
    await expect(page).toHaveURL(new RegExp(`/tables/${tableName}`));
    await expect(page.getByRole('heading', { name: tableName })).toBeVisible();

    // --- Add an item ---
    await page.getByTestId('add-item').click();
    const json = JSON.stringify({ pk: 'USER#1', name: 'Ada', age: 36 }, null, 2);
    await page.getByTestId('item-json').fill(json);
    await page.getByTestId('item-save').click();

    // --- Scan and verify the item is present ---
    await page.getByTestId('run-query').click();
    await expect(page.getByTestId('item-row')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByText('USER#1')).toBeVisible();
    await expect(page.getByText('Ada')).toBeVisible();

    // --- PartiQL SELECT ---
    await page.goto('/partiql');
    await page
      .getByTestId('pql-statement')
      .fill(`SELECT * FROM "${tableName}" WHERE pk = 'USER#1'`);
    await page.getByTestId('pql-execute').click();
    await expect(page.getByText('1 row(s)')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Ada')).toBeVisible();
  });
});
