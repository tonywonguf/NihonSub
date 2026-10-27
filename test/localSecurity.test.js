import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedLocalRequest } from '../localSecurity.js';

test('allows same-origin localhost requests and local clients without Origin', () => {
  assert.equal(isAllowedLocalRequest('localhost:3000', 'http://localhost:3000', 'http', 3000), true);
  assert.equal(isAllowedLocalRequest('127.0.0.1:3000', undefined, 'http', 3000), true);
});

test('rejects remote Host headers and cross-origin browser requests', () => {
  assert.equal(isAllowedLocalRequest('attacker.example:3000', undefined, 'http', 3000), false);
  assert.equal(isAllowedLocalRequest('localhost:3000', 'http://attacker.example', 'http', 3000), false);
  assert.equal(isAllowedLocalRequest('localhost:3001', 'http://localhost:3001', 'http', 3000), false);
});
