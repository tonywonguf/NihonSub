import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRunStore } from '../runStore.js';

test('run log and Japanese checkpoint survive store restart', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nihonsub-runs-'));
  try {
    const store = createRunStore(directory);
    const segments = [{ id: 0, start: 0, end: 1.2, text: 'こんにちは。' }];

    store.start('job-123', { videoFileName: 'video.mkv', transcriptionModel: 'parakeet' });
    store.append('job-123', { type: 'progress', step: 'transcribe', message: 'Parakeet complete' });
    store.saveCheckpoint('job-123', 'japanese', { segments });
    const decisions = [{ choice: 'use-b', decidedAt: '2026-10-27T12:00:00.000Z' }];
    store.saveCheckpoint('job-123', 'ab_decisions', decisions);
    store.append('job-123', { type: 'error', step: 'translate', error: 'Qwen unavailable' });

    const restartedStore = createRunStore(directory);
    const run = restartedStore.get('job-123');
    assert.equal(run.status, 'failed');
    assert.equal(run.lastStep, 'translate');
    assert.deepEqual(run.events.map(event => event.message), ['Parakeet complete', 'Qwen unavailable']);
    assert.deepEqual(restartedStore.loadCheckpoint('job-123', 'japanese'), { segments });
    assert.deepEqual(restartedStore.loadCheckpoint('job-123', 'ab_decisions'), decisions);
    assert.equal(restartedStore.list()[0].jobId, 'job-123');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an unfinished run is marked interrupted after process restart', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nihonsub-interrupted-'));
  try {
    createRunStore(directory).start('job-456');
    const restartedStore = createRunStore(directory);
    restartedStore.markInterrupted();

    const run = restartedStore.get('job-456');
    assert.equal(run.status, 'failed');
    assert.match(run.events.at(-1).message, /server restarted/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('run store rejects path-like job IDs', () => {
  const store = createRunStore(os.tmpdir());
  assert.throws(() => store.get('../outside'), /Invalid job ID/);
});
