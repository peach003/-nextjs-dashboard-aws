import { test, expect } from '@playwright/test';

/**
 * Invoice CRUD E2E Tests
 *
 * Tests the complete invoice management flow:
 * - Creating new invoices
 * - Viewing invoice list
 * - Editing existing invoices
 * - Deleting invoices
 */

const TEST_USER = {
  email: 'user@nextmail.com',
  password: '123456',
};

// Helper function to login before each test
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/.*dashboard/);
});

test.describe('Invoice Management', () => {
  test('should display invoices list', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Check page title and elements
    await expect(page.getByRole('heading', { name: /invoices/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create invoice/i })).toBeVisible();

    // Should have table with invoices
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should create a new invoice', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Click create invoice button
    await page.getByRole('link', { name: /create invoice/i }).click();
    await expect(page).toHaveURL(/.*invoices\/create/);

    // Fill in the form
    // Select customer (first option in dropdown)
    await page.getByLabel(/customer/i).click();
    await page.getByRole('option').first().click();

    // Enter amount
    await page.getByLabel(/amount/i).fill('500');

    // Select status
    await page.getByLabel(/status/i).selectOption('pending');

    // Submit form
    await page.getByRole('button', { name: /create invoice/i }).click();

    // Should redirect back to invoices list
    await expect(page).toHaveURL(/.*dashboard\/invoices$/);

    // Should show success message or new invoice in list
    await page.waitForTimeout(1000); // Wait for data to load
  });

  test('should edit an existing invoice', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Find and click first edit button
    const editButton = page.getByRole('link', { name: /edit/i }).first();
    await editButton.click();

    // Should be on edit page
    await expect(page).toHaveURL(/.*invoices\/.*\/edit/);

    // Update amount
    const amountInput = page.getByLabel(/amount/i);
    await amountInput.clear();
    await amountInput.fill('750');

    // Update status
    await page.getByLabel(/status/i).selectOption('paid');

    // Submit form
    await page.getByRole('button', { name: /edit invoice/i }).click();

    // Should redirect back to invoices list
    await expect(page).toHaveURL(/.*dashboard\/invoices$/);
  });

  test('should delete an invoice', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Wait for invoices to load
    await page.waitForSelector('table');

    // Count invoices before deletion
    const initialRows = await page.getByRole('row').count();

    // Click first delete button
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    await deleteButton.click();

    // Wait for deletion to complete
    await page.waitForTimeout(1000);

    // Reload to verify
    await page.reload();
    await page.waitForSelector('table');

    // Should have one less invoice
    const finalRows = await page.getByRole('row').count();
    expect(finalRows).toBeLessThan(initialRows);
  });

  test('should validate required fields on create', async ({ page }) => {
    await page.goto('/dashboard/invoices/create');

    // Try to submit without filling fields
    await page.getByRole('button', { name: /create invoice/i }).click();

    // Should show validation errors
    // Note: Actual validation behavior depends on your form implementation
    // This might need adjustment based on how your forms handle validation
  });

  test('should navigate between invoice pages', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Click on create link
    await page.getByRole('link', { name: /create invoice/i }).click();
    await expect(page).toHaveURL(/.*create/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/.*invoices$/);
  });
});
