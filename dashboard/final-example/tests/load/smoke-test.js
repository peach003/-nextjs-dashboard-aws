/**
 * K6 Smoke Test
 *
 * A minimal load test to verify the system works under light load.
 * Runs with 1-5 users for 1 minute.
 *
 * Run: k6 run tests/load/smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },  // Ramp up to 5 users
    { duration: '30s', target: 5 },  // Stay at 5 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    errors: ['rate<0.1'],             // Error rate should be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  // Test homepage
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);

  // Test login page
  res = http.get(`${BASE_URL}/login`);
  check(res, {
    'login page status is 200': (r) => r.status === 200,
    'login page has form': (r) => r.body.includes('email'),
  }) || errorRate.add(1);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results/smoke-test-summary.json': JSON.stringify(data),
  };
}
