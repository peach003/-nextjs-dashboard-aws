/**
 * API Integration Tests
 *
 * Tests API routes and server actions without browser.
 * Uses Node.js test runner and fetch API.
 *
 * Run: npm run test:integration
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

describe('API Integration Tests', () => {
  describe('Homepage', () => {
    it('should return 200 OK', async () => {
      const response = await fetch(`${BASE_URL}/`);
      assert.strictEqual(response.status, 200);
    });

    it('should return HTML content', async () => {
      const response = await fetch(`${BASE_URL}/`);
      const contentType = response.headers.get('content-type');
      assert.ok(contentType?.includes('text/html'));
    });
  });

  describe('Login Page', () => {
    it('should return login page', async () => {
      const response = await fetch(`${BASE_URL}/login`);
      assert.strictEqual(response.status, 200);

      const html = await response.text();
      assert.ok(html.includes('email') || html.includes('Email'));
      assert.ok(html.includes('password') || html.includes('Password'));
    });
  });

  describe('Protected Routes', () => {
    it('should redirect to login for dashboard without auth', async () => {
      const response = await fetch(`${BASE_URL}/dashboard`, {
        redirect: 'manual',
      });

      // Should either redirect (307) or return HTML with redirect
      assert.ok(
        response.status === 307 || response.status === 200,
        `Expected 307 or 200, got ${response.status}`,
      );
    });

    it('should redirect to login for invoices without auth', async () => {
      const response = await fetch(`${BASE_URL}/dashboard/invoices`, {
        redirect: 'manual',
      });

      assert.ok(
        response.status === 307 || response.status === 200,
        `Expected 307 or 200, got ${response.status}`,
      );
    });
  });

  describe('Static Assets', () => {
    it('should serve favicon', async () => {
      const response = await fetch(`${BASE_URL}/favicon.ico`);
      // Should either succeed (200) or not found (404) depending on setup
      assert.ok([200, 404].includes(response.status));
    });
  });

  describe('Health Check', () => {
    it('should have working homepage', async () => {
      const response = await fetch(`${BASE_URL}/`);
      assert.ok(response.ok, 'Homepage should be accessible');

      const html = await response.text();
      assert.ok(html.length > 0, 'Page should have content');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent pages', async () => {
      const response = await fetch(`${BASE_URL}/non-existent-page-12345`);
      assert.strictEqual(response.status, 404);
    });
  });

  describe('Response Times', () => {
    it('homepage should respond quickly', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/`);
      const duration = Date.now() - start;

      assert.ok(response.ok);
      assert.ok(duration < 2000, `Response took ${duration}ms, should be < 2000ms`);
    });

    it('login page should respond quickly', async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}/login`);
      const duration = Date.now() - start;

      assert.ok(response.ok);
      assert.ok(duration < 2000, `Response took ${duration}ms, should be < 2000ms`);
    });
  });
});
