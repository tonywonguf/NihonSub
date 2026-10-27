import assert from 'node:assert/strict';
import test from 'node:test';

import { appendExperimentDecision } from '../experimentDecisions.js';

test('appends a timestamped decision without changing earlier decisions', () => {
  const earlier = { choice: 'archive', decidedAt: '2026-10-26T09:00:00.000Z' };
  const history = [earlier];

  const updated = appendExperimentDecision(history, 'current', '2026-10-27T12:00:00.000Z');

  assert.deepEqual(history, [earlier]);
  assert.deepEqual(updated, [earlier, { choice: 'current', decidedAt: '2026-10-27T12:00:00.000Z' }]);
});

test('rejects unknown choices and malformed existing history', () => {
  assert.throws(() => appendExperimentDecision([], 'maybe'), /Invalid decision/);
  assert.throws(() => appendExperimentDecision([], 'current', 'not a date'), /Invalid decision/);
  assert.throws(() => appendExperimentDecision([{ choice: 'current' }], 'archive'), /Invalid decision history/);
});
