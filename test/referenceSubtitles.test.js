import assert from 'node:assert/strict';
import test from 'node:test';

import { parseReferenceSubtitles } from '../referenceSubtitles.js';

test('parses SRT cues and applies a time offset without losing cue text', () => {
  const cues = parseReferenceSubtitles('\uFEFF1\r\n00:00:08,500 --> 00:00:10,200\r\n<i>Reference &amp; context</i>\r\n', {
    offsetSeconds: -8
  });

  assert.deepEqual(cues, [{ id: 0, start: 0.5, end: 2.2, text: 'Reference & context' }]);
});

test('parses WebVTT cues with settings and drops cues before the shifted clip', () => {
  const cues = parseReferenceSubtitles('WEBVTT\n\nNOTE generated reference\nignored\n\n00:00.500 --> 00:02.250 line:90%\n<v Speaker>Hello</v>\n\n00:03.000 --> 00:04.000\nLater cue\n', {
    offsetSeconds: -3
  });

  assert.deepEqual(cues, [{ id: 0, start: 0, end: 1, text: 'Later cue' }]);
});

test('rejects invalid offsets, oversized files, and files without valid subtitle cues', () => {
  assert.throws(() => parseReferenceSubtitles('nothing here'), /No valid subtitle cues/);
  assert.throws(() => parseReferenceSubtitles('00:00:bad --> 00:00:01,000\nText'), /Invalid subtitle timing/);
  assert.throws(() => parseReferenceSubtitles('00:00:00,000 --> 00:00:01,000\nText', {
    offsetSeconds: Infinity
  }), /finite number/);
  assert.throws(() => parseReferenceSubtitles('x'.repeat(5 * 1024 * 1024 + 1)), /smaller than 5 MB/);
});
