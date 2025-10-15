# Testing Guide

This directory contains all tests for the Next.js Dashboard application.

## Test Types

### E2E Tests (Playwright)
Located in: `tests/e2e/`

End-to-end tests that simulate real user interactions in a browser.

**Test Coverage:**
- `auth.spec.ts` - Login/logout flows
- `invoices.spec.ts` - Invoice CRUD operations
- `search-pagination.spec.ts` - Search and pagination

**Run Tests:**
```bash
npm run test:e2e              # Run all E2E tests
npm run test:e2e:ui           # Run with UI mode
npm run test:e2e:headed       # Run in headed mode (see browser)
npm run test:e2e:debug        # Run in debug mode
```

### Integration Tests
Located in: `tests/integration/`

Tests API routes and server functionality without a browser.

**Test Coverage:**
- `api.test.ts` - API routes and response times

**Run Tests:**
```bash
npm run test:integration     # Run integration tests
```

### Load Tests (k6)
Located in: `tests/load/`

Performance and stress testing.

**Test Coverage:**
- `smoke-test.js` - Quick verification (1-5 users)
- `load-test.js` - Normal load (50-100 users)
- `stress-test.js` - Heavy load (up to 500 users)

**Run Tests:**
```bash
# Install k6 first: https://k6.io/docs/getting-started/installation/

k6 run tests/load/smoke-test.js        # Smoke test
k6 run tests/load/load-test.js         # Load test
k6 run tests/load/stress-test.js       # Stress test

# With custom target
k6 run tests/load/load-test.js -e BASE_URL=https://your-staging-url.com
```

## Prerequisites

### For E2E Tests (Playwright)
```bash
npm install
npx playwright install
```

### For Load Tests (k6)
Install k6:
- **macOS**: `brew install k6`
- **Linux**: See https://k6.io/docs/getting-started/installation/
- **Windows**: `choco install k6`

## Running Tests

### All Tests
```bash
npm test                      # Run linting and formatting checks
npm run test:all              # Run all tests (E2E + integration)
```

### E2E Tests Only
```bash
npm run test:e2e              # Headless mode
npm run test:e2e:headed       # See browser
npm run test:e2e:ui           # Interactive UI mode
npm run test:e2e:debug        # Debug mode with DevTools
```

### Integration Tests
```bash
npm run test:integration      # Run API integration tests
```

### Load Tests
```bash
# Run with k6 directly
k6 run tests/load/smoke-test.js
k6 run tests/load/load-test.js
k6 run tests/load/stress-test.js
```

## Test Configuration

### Playwright Configuration
File: `playwright.config.ts`

Key settings:
- Timeout: 30 seconds per test
- Retries: 2 on CI, 0 locally
- Base URL: `http://localhost:3001`
- Browsers: Chromium (default), Firefox, WebKit
- Reports: HTML, JUnit, List

### Environment Variables
```bash
# E2E tests
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3001

# Integration tests
TEST_BASE_URL=http://localhost:3001

# Load tests
BASE_URL=http://localhost:3001
```

## CI/CD Integration

Tests are automatically run in GitHub Actions:

1. **Pull Requests**: E2E and integration tests
2. **Main branch**: All tests + load tests
3. **Before deployment**: Full test suite

## Test Data

Tests use seeded data from the database:

**Test User:**
- Email: `user@nextmail.com`
- Password: `123456`

**Test Customers:**
- Multiple seeded customers for invoice tests
- See `app/lib/placeholder-data.ts`

## Writing New Tests

### E2E Test Template
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup code
  });

  test('should do something', async ({ page }) => {
    // Test code
    await page.goto('/');
    await expect(page).toHaveTitle(/Expected Title/);
  });
});
```

### Integration Test Template
```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Feature', () => {
  it('should work', async () => {
    const response = await fetch('http://localhost:3001/api/endpoint');
    assert.strictEqual(response.status, 200);
  });
});
```

### Load Test Template
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
  ],
};

export default function () {
  const res = http.get('http://localhost:3001');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

## Debugging Tests

### Playwright
```bash
# UI Mode (best for debugging)
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Show browser
npm run test:e2e:headed

# Generate test code
npx playwright codegen http://localhost:3001
```

### View Test Reports
```bash
# Playwright HTML report
npx playwright show-report

# Load test results
ls load-test-results/
```

## Performance Targets

### E2E Tests
- Each test: < 30 seconds
- Full suite: < 5 minutes
- Success rate: > 95%

### Load Tests
- **Smoke**: 5 users, 0 errors
- **Load**: 100 users, < 5% errors, p95 < 1s
- **Stress**: Find breaking point, document max capacity

### Integration Tests
- Response time: < 2 seconds
- Success rate: 100%

## Troubleshooting

### E2E Tests Fail
1. Check dev server is running: `npm run dev`
2. Check database is seeded: `curl http://localhost:3001/seed`
3. Clear browser state: `rm -rf playwright-report test-results`
4. Update Playwright: `npm install @playwright/test@latest`

### Load Tests Fail
1. Check k6 is installed: `k6 version`
2. Check target URL is accessible
3. Start with smoke test first
4. Increase timeouts for slower environments

### Integration Tests Fail
1. Check server is running
2. Check environment variables are set
3. Check network connectivity
4. Review test assertions

## Resources

- [Playwright Documentation](https://playwright.dev)
- [k6 Documentation](https://k6.io/docs)
- [Node.js Test Runner](https://nodejs.org/api/test.html)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
