import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 }, // Ramp up
    { duration: '20s', target: 200 }, // High load
    { duration: '10s', target: 0 }, // Ramp down
  ],
};

export default function () {
  const url = 'http://localhost:3000/api/v1/queues/default/jobs';
  
  // Use idempotency key to prevent double submissions if k6 retries
  const idempotencyKey = `k6-${__VU}-${__ITER}`;
  
  const payload = JSON.stringify({
    type: 'welcome_email',
    payload: { email: `test-${idempotencyKey}@example.com` },
    idempotency_key: idempotencyKey,
    priority: 1
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (__ENV.API_KEY) {
    params.headers['x-api-key'] = __ENV.API_KEY;
  } else if (__ENV.TOKEN) {
    params.headers['Authorization'] = `Bearer ${__ENV.TOKEN}`;
  }

  const res = http.post(url, payload, params);
  
  check(res, {
    'job accepted (201)': (r) => r.status === 201,
    'job deduplicated (200)': (r) => r.status === 200,
    'backpressure (429)': (r) => r.status === 429,
  });
  
  // Very short sleep to maximize throughput
  sleep(0.01);
}
