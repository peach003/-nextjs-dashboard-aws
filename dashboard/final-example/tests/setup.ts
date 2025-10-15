/**
 * Test Setup and Utilities
 *
 * Shared test configuration and helper functions.
 */

// Test credentials
export const TEST_USER = {
  email: 'user@nextmail.com',
  password: '123456',
};

// Test URLs
export const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001';

// Helper functions for tests
export const testHelpers = {
  /**
   * Wait for a specific time
   */
  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Generate random invoice amount
   */
  randomAmount: () => Math.floor(Math.random() * 1000) + 100,

  /**
   * Generate random email
   */
  randomEmail: () => `test-${Date.now()}@example.com`,

  /**
   * Format currency
   */
  formatCurrency: (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  },
};

export default testHelpers;
