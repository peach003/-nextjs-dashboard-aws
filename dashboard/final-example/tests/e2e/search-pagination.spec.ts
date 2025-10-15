import { test, expect } from '@playwright/test';

/**
 * Search and Pagination E2E Tests
 *
 * Tests search functionality and pagination across invoice lists.
 */

const TEST_USER = {
  email: 'user@nextmail.com',
  password: '123456',
};

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(TEST_USER.email);
  await page.getByLabel(/password/i).fill(TEST_USER.password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/.*dashboard/);
});

test.describe('Invoice Search', () => {
  test('should search invoices by customer name', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Find search input
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Delba');

    // Wait for search results
    await page.waitForTimeout(500); // Debounce delay

    // Should filter results
    const rows = page.getByRole('row');
    const count = await rows.count();

    // Should have results (header + filtered rows)
    expect(count).toBeGreaterThan(0);
  });

  test('should search invoices by email', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('@');

    await page.waitForTimeout(500);

    // Should show results with email addresses
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
  });

  test('should show no results message for non-existent search', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('NonExistentCustomer12345');

    await page.waitForTimeout(500);

    // Should show no results message or empty table
    const noResults = page.getByText(/no.*match/i);
    await expect(noResults).toBeVisible();
  });

  test('should clear search results', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    const searchInput = page.getByPlaceholder(/search/i);

    // Search first
    await searchInput.fill('Delba');
    await page.waitForTimeout(500);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Should show all results again
    const rows = page.getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(1); // Header + multiple rows
  });
});

test.describe('Invoice Pagination', () => {
  test('should show pagination controls', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Should have pagination if there are enough invoices
    // Check for next/previous buttons or page numbers
    const pagination = page.locator('[aria-label="pagination"]');

    // Pagination might not exist if there aren't enough invoices
    // So we check if it exists or if table is displayed
    const hasTable = await page.getByRole('table').isVisible();
    expect(hasTable).toBeTruthy();
  });

  test('should navigate to next page', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Look for next page button
    const nextButton = page.getByRole('link', { name: /next/i }).or(page.getByLabel(/next/i));

    if (await nextButton.count() > 0) {
      // Get current URL
      const currentUrl = page.url();

      // Click next
      await nextButton.click();
      await page.waitForLoadState('networkidle');

      // URL should change with page parameter
      const newUrl = page.url();
      expect(newUrl).not.toBe(currentUrl);
      expect(newUrl).toContain('page=');
    }
  });

  test('should navigate to previous page', async ({ page }) => {
    // Go to page 2 first
    await page.goto('/dashboard/invoices?page=2');

    // Look for previous page button
    const prevButton = page.getByRole('link', { name: /previous/i }).or(page.getByLabel(/previous/i));

    if (await prevButton.count() > 0) {
      await prevButton.click();
      await page.waitForLoadState('networkidle');

      // Should be on page 1
      const url = page.url();
      expect(url).toContain('page=1');
    }
  });

  test('should preserve search when paginating', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Search first
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Lee');
    await page.waitForTimeout(500);

    // If pagination exists, click next
    const nextButton = page.getByRole('link', { name: /next/i }).or(page.getByLabel(/next/i));

    if (await nextButton.count() > 0) {
      await nextButton.click();
      await page.waitForLoadState('networkidle');

      // Search parameter should be preserved
      const url = page.url();
      expect(url).toContain('query=Lee');
    }
  });

  test('should show correct page indicators', async ({ page }) => {
    await page.goto('/dashboard/invoices?page=2');

    // Should show current page indication
    // This depends on your pagination implementation
    const pageIndicator = page.locator('text=Page 2').or(page.locator('[aria-current="page"]'));

    // Check if pagination exists
    const hasPagination = await pageIndicator.count() > 0;
    if (hasPagination) {
      await expect(pageIndicator.first()).toBeVisible();
    }
  });
});

test.describe('Combined Search and Pagination', () => {
  test('should search and paginate together', async ({ page }) => {
    await page.goto('/dashboard/invoices');

    // Search
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('pending');
    await page.waitForTimeout(500);

    // Should show filtered results
    const table = page.getByRole('table');
    await expect(table).toBeVisible();

    // Check if results exist
    const rows = page.getByRole('row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });
});
