/**
 * K6 Stress Test
 *
 * Tests the system under heavy load to find breaking points.
 * Gradually increases load until system fails or reaches 500 users.
 *
 * Run: k6 run tests/load/stress-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp to 100 users
    { duration: '3m', target: 200 },  // Ramp to 200 users
    { duration: '3m', target: 300 },  // Ramp to 300 users
    { duration: '3m', target: 400 },  // Ramp to 400 users
    { duration: '3m', target: 500 },  // Ramp to 500 users (stress!)
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% < 3s (relaxed for stress test)
    http_req_failed: ['rate<0.2'],     // Allow up to 20% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  // Test homepage
  const res = http.get(`${BASE_URL}/`, {
    timeout: '10s', // Longer timeout for stress test
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 5000,
  }) || errorRate.add(1);

  sleep(0.5); // Shorter sleep for stress test
}

export function handleSummary(data) {
  console.log('Stress Test Summary:');
  console.log(`  Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`  Failed Requests: ${data.metrics.http_req_failed.values.passes || 0}`);
  console.log(`  Avg Duration: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`  P95 Duration: ${data.metrics['http_req_duration{p(95)}'] || 'N/A'}`);
  console.log(`  Error Rate: ${((errorRate.rate || 0) * 100).toFixed(2)}%`);

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results/stress-test-summary.json': JSON.stringify(data),
  };
}
