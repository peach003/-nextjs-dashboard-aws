/**
 * K6 Load Test
 *
 * Tests the system under normal expected load.
 * Simulates 50-100 concurrent users over 5 minutes.
 *
 * Run: k6 run tests/load/load-test.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 50 },   // Ramp down to 50 users
    { duration: '1m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% < 1s, 99% < 2s
    http_req_failed: ['rate<0.05'],                   // Error rate < 5%
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  // Homepage
  group('Homepage', function () {
    const res = http.get(`${BASE_URL}/`);
    check(res, {
      'homepage loaded': (r) => r.status === 200,
    }) || errorRate.add(1);
  });

  sleep(Math.random() * 3 + 1); // Random sleep 1-4 seconds

  // Login page
  group('Login Page', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/login`);
    const duration = Date.now() - start;

    check(res, {
      'login page loaded': (r) => r.status === 200,
      'login form present': (r) => r.body.includes('email'),
    }) || errorRate.add(1);

    loginDuration.add(duration);
  });

  sleep(Math.random() * 2 + 1);

  // Simulate authenticated user behavior
  group('Dashboard (Public)', function () {
    // Note: This tests the redirect behavior, not actual dashboard
    // For authenticated tests, you'd need to handle cookies/sessions
    const start = Date.now();
    const res = http.get(`${BASE_URL}/dashboard`);
    const duration = Date.now() - start;

    // Should redirect to login
    check(res, {
      'dashboard redirects': (r) => r.status === 200,
    }) || errorRate.add(1);

    dashboardDuration.add(duration);
  });

  sleep(Math.random() * 5 + 2);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results/load-test-summary.json': JSON.stringify(data),
  };
}
