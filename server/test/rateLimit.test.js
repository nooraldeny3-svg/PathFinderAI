import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../src/middleware/rateLimit.js';

function call(limiter, ip) {
  const headers = {};
  let error;
  limiter({ ip }, { set: (k, v) => { headers[k] = v; } }, (err) => { error = err; });
  return { error, headers };
}

test('allows requests up to the limit, then responds 429 with Retry-After', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2 });
  assert.equal(call(limiter, '1.1.1.1').error, undefined);
  assert.equal(call(limiter, '1.1.1.1').error, undefined);

  const { error, headers } = call(limiter, '1.1.1.1');
  assert.equal(error.status, 429);
  assert.ok(Number(headers['Retry-After']) > 0);
});

test('counts each IP separately', () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 1 });
  assert.equal(call(limiter, '1.1.1.1').error, undefined);
  assert.equal(call(limiter, '2.2.2.2').error, undefined);
  assert.equal(call(limiter, '1.1.1.1').error.status, 429);
});

test('resets after the window expires', async () => {
  const limiter = rateLimit({ windowMs: 20, max: 1 });
  call(limiter, '1.1.1.1');
  assert.equal(call(limiter, '1.1.1.1').error.status, 429);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(call(limiter, '1.1.1.1').error, undefined);
});
