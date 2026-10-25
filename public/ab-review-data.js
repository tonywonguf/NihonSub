export function formatTime(value) {
  const hundredths = Math.round(Math.max(0, Number(value) || 0) * 100);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = ((hundredths % 6000) / 100).toFixed(2).padStart(5, '0');
  return `${String(minutes).padStart(2, '0')}:${seconds}`;
}

export function getActiveCue(segments, time) {
  return segments.find(segment => segment.start <= time && time < segment.end) || null;
}

export function summarizeExperiment(run, aSegments = [], bSegments = []) {
  const candidate = run.metadata?.candidate || {};
  const title = candidate.translationPrompt
    ? 'Qwen prompt comparison'
    : Number.isFinite(candidate.maxCueDurationSeconds)
      ? 'Cue timing & context'
      : run.metadata?.originalName?.split('·').at(-1).trim() || 'Saved A/B experiment';

  let what = run.metadata?.description || 'Compare the saved A baseline with the B candidate.';
  let why = run.metadata?.rationale || 'This run did not save a test rationale.';
  let before = 'A — baseline subtitles';
  let after = 'B — candidate subtitles';

  if (candidate.translationPrompt) {
    what = 'Compare the prior Qwen translation prompt with the Japanese-authoritative, accuracy-first prompt.';
    why = 'The Japanese transcript and cue timings stay fixed, isolating the prompt wording.';
    before = 'A — prior-prompt output copied from the previous experiment.';
    after = `B — translated with the ${candidate.translationPrompt} prompt.`;
  } else if (Number.isFinite(candidate.maxCueDurationSeconds)) {
    const context = candidate.context || 'past-only context';
    what = `Compare the untouched subtitles with cues capped at ${candidate.maxCueDurationSeconds} seconds and ${context}.`;
    why = 'Test shorter subtitle units without rerunning Parakeet or changing the source dialogue.';
    before = 'A — untouched existing English subtitles.';
    after = `B — translated from the same Japanese transcript, with cues capped at ${candidate.maxCueDurationSeconds} seconds.`;
  }

  const cueCounts = { a: aSegments.length, b: bSegments.length };
  if (!aSegments.length || !bSegments.length) {
    return { title, what, why, before, after, result: 'Saved subtitle outputs are not available.', cueCounts, sameTiming: false, changedTextCount: null };
  }

  const sameTiming = aSegments.length === bSegments.length && aSegments.every((segment, index) =>
    Math.abs(segment.start - bSegments[index].start) < 0.001 &&
    Math.abs(segment.end - bSegments[index].end) < 0.001
  );
  const changedTextCount = sameTiming
    ? aSegments.filter((segment, index) => segment.text.trim() !== bSegments[index].text.trim()).length
    : null;
  const result = sameTiming
    ? `${cueCounts.a} cues each; timings match; ${changedTextCount} cue texts differ.`
    : `A has ${cueCounts.a} cues; B has ${cueCounts.b}; cue boundaries differ.`;

  return { title, what, why, before, after, result, cueCounts, sameTiming, changedTextCount };
}
