import assert from 'node:assert/strict';
import test from 'node:test';

import { appendExperimentDecision } from '../experimentDecisions.js';

test('appends all three timestamped outcomes without changing earlier decisions', () => {
  const history = [];
  const keepA = appendExperimentDecision(history, 'keep-a', '2026-10-26T09:00:00.000Z');
  const useB = appendExperimentDecision(keepA, 'use-b', '2026-10-27T12:00:00.000Z');
  const inconclusive = appendExperimentDecision(useB, 'inconclusive', '2026-10-28T12:00:00.000Z');

  assert.deepEqual(history, []);
  assert.deepEqual(keepA, [{ choice: 'keep-a', decidedAt: '2026-10-26T09:00:00.000Z' }]);
  assert.deepEqual(useB, [
    { choice: 'keep-a', decidedAt: '2026-10-26T09:00:00.000Z' },
    { choice: 'use-b', decidedAt: '2026-10-27T12:00:00.000Z' }
  ]);
  assert.deepEqual(inconclusive, [
    { choice: 'keep-a', decidedAt: '2026-10-26T09:00:00.000Z' },
    { choice: 'use-b', decidedAt: '2026-10-27T12:00:00.000Z' },
    { choice: 'inconclusive', decidedAt: '2026-10-28T12:00:00.000Z' }
  ]);
});

test('rejects unknown choices and malformed existing history', () => {
  assert.throws(() => appendExperimentDecision([], 'maybe'), /Invalid decision/);
  assert.throws(() => appendExperimentDecision([], 'current', 'not a date'), /Invalid decision/);
  assert.throws(() => appendExperimentDecision([{ choice: 'current' }], 'archive'), /Invalid decision history/);
});
