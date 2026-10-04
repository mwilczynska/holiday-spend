import { expect, test } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'node:path';

test('failed server-rendered expense reads show unavailable totals and recover with Retry', async ({ page }) => {
  const fixturePath = process.env.HOLIDAY_SPEND_DB_PATH;
  test.skip(!fixturePath || !path.resolve(fixturePath).replaceAll('\\', '/').includes('/.local/feature-qa/'), 'Requires the isolated feature QA database.');
  const fixture = new Database(fixturePath!);
  let suspended = false;
  try {
    expect(fixture.prepare("SELECT email FROM user WHERE id='dev-local-user'").get()).toEqual({ email: 'feature-qa@example.test' });
    fixture.exec('ALTER TABLE expenses RENAME TO qa_suspended_expenses');
    suspended = true;
    await page.goto('/track');
    await expect(page.getByRole('button', { name: 'Retry loading expenses', exact: true })).toBeVisible();
    await expect(page.getByText('Expense count unavailable', { exact: true })).toBeVisible();
    await expect(page.getByText('AUD total unavailable', { exact: true })).toBeVisible();
    await expect(page.getByText('No expenses yet.', { exact: true }).filter({ visible: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
    fixture.exec('ALTER TABLE qa_suspended_expenses RENAME TO expenses');
    suspended = false;
    await page.getByRole('button', { name: 'Retry loading expenses', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry loading expenses', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('expense-table').locator('tbody tr').first()).not.toContainText('Expenses unavailable');
    await expect(page.getByText('AUD total unavailable', { exact: true })).toHaveCount(0);
  } finally {
    if (suspended) fixture.exec('ALTER TABLE qa_suspended_expenses RENAME TO expenses');
    fixture.close();
  }
});
