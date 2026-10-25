import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, getActiveCue, summarizeExperiment } from '../public/ab-review-data.js';

test('formats video time and finds cues at their start and end boundaries', () => {
  const cues = [{ start: 1.25, end: 2.5, text: 'hello' }];
  assert.equal(formatTime(65.2), '01:05.20');
  assert.equal(formatTime(59.999), '01:00.00');
  assert.equal(getActiveCue(cues, 1.25), cues[0]);
  assert.equal(getActiveCue(cues, 2.5), null);
});

test('summarizes a cue segmentation experiment without claiming quality improvement', () => {
  const run = { metadata: { candidate: { maxCueDurationSeconds: 4, context: 'current and previous four cues only' } } };
  const summary = summarizeExperiment(run, Array(6).fill({}), Array(11).fill({}));
  assert.equal(summary.title, 'Cue timing & context');
  assert.match(summary.what, /capped at 4 seconds/);
  assert.equal(summary.cueCounts.a, 6);
  assert.equal(summary.cueCounts.b, 11);
  assert.equal(summary.sameTiming, false);
  assert.equal(summary.changedTextCount, null);
});

test('isolates prompt changes when cue timing is identical', () => {
  const run = { metadata: { candidate: { translationPrompt: 'Japanese-authoritative, accuracy-first, anti-embellishment' } } };
  const a = [{ start: 1, end: 2, text: 'A' }, { start: 3, end: 4, text: 'same' }];
  const b = [{ start: 1, end: 2, text: 'B' }, { start: 3, end: 4, text: 'same' }];
  const summary = summarizeExperiment(run, a, b);
  assert.equal(summary.title, 'Qwen prompt comparison');
  assert.equal(summary.sameTiming, true);
  assert.equal(summary.changedTextCount, 1);
  assert.match(summary.result, /2 cues each; timings match; 1 cue texts differ/);
});
