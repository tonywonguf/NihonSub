import { formatTime, getActiveCue, summarizeExperiment } from './ab-review-data.js';

const experimentList = document.getElementById('experimentList');
const experimentCount = document.getElementById('experimentCount');
const reviewQueueButton = document.getElementById('reviewQueueButton');
const decisionArchiveButton = document.getElementById('decisionArchiveButton');
const reviewQueueCount = document.getElementById('reviewQueueCount');
const decisionArchiveCount = document.getElementById('decisionArchiveCount');
const decisionState = document.getElementById('decisionState');
const decisionSummary = document.getElementById('decisionSummary');
const decisionHistoryList = document.getElementById('decisionHistoryList');
const decisionStatus = document.getElementById('decisionStatus');
const decisionButtons = [...document.querySelectorAll('[data-decision]')];
const pageStatus = document.getElementById('pageStatus');
const selectedExperiment = document.getElementById('selectedExperiment');
const selectedTitle = document.getElementById('selectedTitle');
const selectedSource = document.getElementById('selectedSource');
const selectedState = document.getElementById('selectedState');
const experimentWhat = document.getElementById('experimentWhat');
const experimentWhy = document.getElementById('experimentWhy');
const experimentBeforeAfter = document.getElementById('experimentBeforeAfter');
const experimentResult = document.getElementById('experimentResult');
const reviewVideo = document.getElementById('reviewVideo');
const videoMessage = document.getElementById('videoMessage');
const videoTime = document.getElementById('videoTime');
const railCurrentTime = document.getElementById('railCurrentTime');
const videoDuration = document.getElementById('videoDuration');
const timeRail = document.getElementById('timeRail');
const timeRailRow = timeRail.closest('.time-rail-row');
const timePlayhead = document.getElementById('timePlayhead');
const captionA = document.getElementById('captionA');
const captionB = document.getElementById('captionB');
const captionTextA = document.getElementById('captionTextA');
const captionTextB = document.getElementById('captionTextB');
const captionReference = document.getElementById('captionReference');
const captionTextReference = document.getElementById('captionTextReference');
const trackAList = document.getElementById('trackAList');
const trackBList = document.getElementById('trackBList');
const trackReferenceColumn = document.getElementById('referenceTrackColumn');
const trackReferenceList = document.getElementById('trackReferenceList');
const countA = document.getElementById('countA');
const countB = document.getElementById('countB');
const countReference = document.getElementById('countReference');
const transcriptGrid = document.querySelector('.transcript-grid');
const referenceStatus = document.getElementById('referenceStatus');
const referenceForm = document.getElementById('referenceForm');
const referenceFile = document.getElementById('referenceFile');
const referenceOffset = document.getElementById('referenceOffset');
const referenceLoadStatus = document.getElementById('referenceLoadStatus');
const attachReference = document.getElementById('attachReference');
const playbackTrack = document.getElementById('playbackTrack');
const referenceTrackOption = playbackTrack.querySelector('option[value="reference"]');
const transcriptStatus = document.getElementById('transcriptStatus');

let runs = [];
let activeRunId = null;
let activeDecisionView = new URLSearchParams(location.search).get('view') === 'history' ? 'archive' : 'pending';
let aSegments = [];
let bSegments = [];
let referenceSegments = [];
let referenceSource = null;
let referenceLoadVersion = 0;
let selectionVersion = 0;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function setStatus(message = '') {
  pageStatus.textContent = message;
}

function updateReviewUrl() {
  const params = new URLSearchParams();
  if (activeRunId) params.set('runId', activeRunId);
  if (activeDecisionView === 'archive') params.set('view', 'history');
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Saved run' : date.toLocaleDateString();
}

function formatDecisionDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function getDecisions(run) {
  return Array.isArray(run.decisions) ? run.decisions : [];
}

function getDecisionLabel(choice) {
  return ({
    'keep-a': 'Keep A',
    'use-b': 'Use candidate B',
    inconclusive: 'Inconclusive',
    current: 'Use candidate B',
    archive: 'Keep A'
  })[choice] || 'Unknown decision';
}

function getVisibleRuns() {
  return runs.filter(run => activeDecisionView === 'pending'
    ? getDecisions(run).length === 0
    : getDecisions(run).length > 0)
    .sort((a, b) => {
      const aDate = activeDecisionView === 'archive' ? getDecisions(a).at(-1).decidedAt : a.startedAt;
      const bDate = activeDecisionView === 'archive' ? getDecisions(b).at(-1).decidedAt : b.startedAt;
      return bDate.localeCompare(aDate);
    });
}

function renderExperimentList() {
  const pending = runs.filter(run => getDecisions(run).length === 0).length;
  const archived = runs.length - pending;
  const visibleRuns = getVisibleRuns();
  experimentList.replaceChildren();
  experimentCount.textContent = `${runs.length} total`;
  reviewQueueCount.textContent = String(pending);
  decisionArchiveCount.textContent = String(archived);
  reviewQueueButton.setAttribute('aria-pressed', String(activeDecisionView === 'pending'));
  decisionArchiveButton.setAttribute('aria-pressed', String(activeDecisionView === 'archive'));

  if (!runs.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-library';
    const message = document.createElement('p');
    message.textContent = 'No saved experiments yet.';
    const link = document.createElement('a');
    link.className = 'empty-library-link';
    link.href = '/';
    link.textContent = 'Open Subtitler';
    empty.append(message, link);
    experimentList.appendChild(empty);
    return;
  }

  if (!visibleRuns.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-library';
    const message = document.createElement('p');
    message.textContent = activeDecisionView === 'pending'
      ? 'You’re all caught up. New experiments will appear here until reviewed.'
      : 'No decisions archived yet. Review an experiment to record one.';
    empty.appendChild(message);
    experimentList.appendChild(empty);
    return;
  }

  for (const run of visibleRuns) {
    const summary = summarizeExperiment(run);
    const decisions = getDecisions(run);
    const latestDecision = decisions.at(-1);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'experiment-option';
    button.dataset.runId = run.jobId;
    button.setAttribute('aria-pressed', String(run.jobId === activeRunId));

    const titleRow = document.createElement('span');
    titleRow.className = 'option-title-row';
    const title = document.createElement('span');
    title.className = 'option-title';
    title.textContent = summary.title;
    const date = document.createElement('span');
    date.className = 'option-date';
    date.textContent = formatDate(run.startedAt);
    titleRow.append(title, date);

    const state = document.createElement('span');
    state.className = 'option-state';
    state.textContent = latestDecision ? getDecisionLabel(latestDecision.choice) : 'Needs review';

    button.append(titleRow, state);
    if (latestDecision) {
      const outcome = document.createElement('span');
      outcome.className = 'option-outcome';
      const label = document.createElement('span');
      label.textContent = decisions.length > 1 ? `${decisions.length} decisions · latest: ${getDecisionLabel(latestDecision.choice)}` : getDecisionLabel(latestDecision.choice);
      const timestamp = document.createElement('time');
      timestamp.dateTime = latestDecision.decidedAt;
      timestamp.textContent = formatDecisionDate(latestDecision.decidedAt);
      outcome.append(label, timestamp);
      button.appendChild(outcome);
    } else {
      const copy = document.createElement('span');
      copy.className = 'option-copy';
      for (const [label, value] of [['What', summary.what], ['Why', summary.why]]) {
        const line = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        line.append(strong, document.createTextNode(value));
        copy.appendChild(line);
      }
      button.appendChild(copy);
    }

    button.addEventListener('click', () => selectExperiment(run));
    experimentList.appendChild(button);
  }
}

function renderDecisionPanel(run) {
  const decisions = getDecisions(run);
  const latestDecision = decisions.at(-1);
  decisionState.textContent = latestDecision ? 'Decision recorded' : 'Needs review';
  decisionState.classList.toggle('is-decided', Boolean(latestDecision));
  decisionSummary.textContent = latestDecision
    ? `${getDecisionLabel(latestDecision.choice)} · ${formatDecisionDate(latestDecision.decidedAt)}${decisions.length > 1 ? ` · ${decisions.length} decisions recorded` : ''}`
    : 'Watch both subtitle tracks, then record the outcome.';
  decisionHistoryList.replaceChildren();
  decisionHistoryList.hidden = decisions.length === 0;

  [...decisions].reverse().forEach((decision, index) => {
    const row = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${index === 0 ? 'Latest' : 'Previous'} · ${getDecisionLabel(decision.choice)}`;
    const timestamp = document.createElement('time');
    timestamp.dateTime = decision.decidedAt;
    timestamp.textContent = formatDecisionDate(decision.decidedAt);
    row.append(label, timestamp);
    decisionHistoryList.appendChild(row);
  });
}

function renderTrack(list, segments, track) {
  list.replaceChildren();
  if (!segments.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-track';
    empty.textContent = 'No cues saved for this track.';
    list.appendChild(empty);
    return;
  }

  segments.forEach((segment, index) => {
    const row = document.createElement('li');
    row.className = 'cue-row';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cue-jump';
    button.dataset.index = String(index);
    button.dataset.start = String(segment.start);
    button.setAttribute('aria-label', `${formatTime(segment.start)} to ${formatTime(segment.end)}: ${segment.text}`);

    const time = document.createElement('span');
    time.className = 'cue-time';
    time.textContent = `${formatTime(segment.start)}–${formatTime(segment.end)}`;
    const copy = document.createElement('span');
    copy.className = 'cue-copy';
    copy.textContent = segment.text;
    button.append(time, copy);
    row.appendChild(button);
    list.appendChild(row);
  });
}

function updateTrack(list, segments, current) {
  const activeIndex = segments.indexOf(current);
  list.querySelectorAll('.cue-jump').forEach((button, index) => {
    const isCurrent = index === activeIndex;
    button.classList.toggle('is-current', isCurrent);
    if (isCurrent) button.setAttribute('aria-current', 'time');
    else button.removeAttribute('aria-current');
  });
}

function updatePlayback() {
  const currentTime = Number.isFinite(reviewVideo.currentTime) ? reviewVideo.currentTime : 0;
  const duration = Number.isFinite(reviewVideo.duration) ? reviewVideo.duration : 0;
  const hasDuration = duration > 0;
  videoTime.classList.toggle('hidden', !hasDuration);
  timeRailRow.classList.toggle('hidden', !hasDuration);
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const activeA = getActiveCue(aSegments, currentTime);
  const activeB = getActiveCue(bSegments, currentTime);
  const activeReference = getActiveCue(referenceSegments, currentTime);
  const showReference = playbackTrack.value === 'reference' && referenceSegments.length > 0;

  videoTime.textContent = formatTime(currentTime);
  railCurrentTime.textContent = formatTime(currentTime);
  videoDuration.textContent = duration > 0 ? formatTime(duration) : '--:--.--';
  timePlayhead.style.left = `${progress}%`;
  timeRail.setAttribute('aria-valuenow', String(Math.round(progress)));

  captionA.hidden = showReference || !activeA;
  captionB.hidden = showReference || !activeB;
  captionReference.hidden = !showReference || !activeReference;
  captionTextA.textContent = activeA?.text || '';
  captionTextB.textContent = activeB?.text || '';
  captionTextReference.textContent = activeReference?.text || '';
  updateTrack(trackAList, aSegments, activeA);
  updateTrack(trackBList, bSegments, activeB);
  updateTrack(trackReferenceList, referenceSegments, activeReference);
}

function clearComparison() {
  referenceLoadVersion++;
  referenceSource = null;
  referenceFile.value = '';
  referenceFile.disabled = true;
  attachReference.disabled = true;
  aSegments = [];
  bSegments = [];
  referenceSegments = [];
  renderTrack(trackAList, aSegments, 'A');
  renderTrack(trackBList, bSegments, 'B');
  renderTrack(trackReferenceList, referenceSegments, 'Reference');
  countA.textContent = '0 cues';
  countB.textContent = '0 cues';
  countReference.textContent = '0 cues';
  transcriptGrid.classList.remove('has-reference');
  trackReferenceColumn.hidden = true;
  referenceTrackOption.disabled = true;
  playbackTrack.value = 'both';
  referenceStatus.textContent = 'Checking the source video…';
  referenceOffset.value = '0';
  referenceOffset.disabled = true;
  referenceLoadStatus.textContent = '';
  transcriptStatus.textContent = '';
  captionA.hidden = true;
  captionB.hidden = true;
  captionReference.hidden = true;
  videoTime.classList.add('hidden');
  timeRailRow.classList.add('hidden');
  reviewVideo.controls = false;
  reviewVideo.pause();
  reviewVideo.removeAttribute('src');
  reviewVideo.load();
  videoMessage.classList.remove('hidden');
  videoMessage.textContent = 'Select an experiment to load its video and subtitle tracks.';
  videoDuration.textContent = '--:--.--';
  timePlayhead.style.left = '0%';
}

function renderReferenceTrack(segments, available) {
  referenceSegments = Array.isArray(segments) ? segments : [];
  trackReferenceColumn.hidden = !available;
  transcriptGrid.classList.toggle('has-reference', available);
  referenceTrackOption.disabled = !available || referenceSegments.length === 0;
  countReference.textContent = `${referenceSegments.length} ${referenceSegments.length === 1 ? 'cue' : 'cues'}`;
  renderTrack(trackReferenceList, referenceSegments, 'Reference');
  updatePlayback();
}

async function loadEmbeddedReference(runId, selection) {
  const requestVersion = ++referenceLoadVersion;
  const params = new URLSearchParams({ offsetSeconds: referenceOffset.value || '0' });
  referenceSource = 'embedded';
  referenceStatus.textContent = 'Reading embedded subtitle tracks…';
  referenceLoadStatus.textContent = '';

  const data = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/embedded-reference?${params}`);
  if (selection !== selectionVersion || requestVersion !== referenceLoadVersion) return;

  if (!data.available || !data.selectedTrack) {
    referenceSource = null;
    renderReferenceTrack([], false);
    referenceStatus.textContent = data.message || 'No embedded subtitle track available.';
    return;
  }

  referenceOffset.disabled = false;
  referenceOffset.value = String(data.offsetSeconds ?? 0);
  renderReferenceTrack(data.segments, true);
  const language = data.selectedTrack.language || 'unknown language';
  const title = data.selectedTrack.title ? ` · ${data.selectedTrack.title}` : '';
  const defaultLabel = data.selectedTrack.default ? ' · default' : '';
  referenceStatus.textContent = `${language}${title}${defaultLabel} · ${referenceSegments.length} cues`;
}

function showStoredReference(reference) {
  referenceSource = 'uploaded';
  referenceOffset.disabled = false;
  referenceOffset.value = String(reference.offsetSeconds ?? 0);
  renderReferenceTrack(reference.segments, true);
  const offset = Number(reference.offsetSeconds || 0);
  const signedOffset = `${offset >= 0 ? '+' : ''}${offset}s`;
  referenceStatus.textContent = `${reference.fileName || 'Reference file'} · ${referenceSegments.length} cues · offset ${signedOffset}`;
}

function showReferenceError(error, selection) {
  if (selection !== selectionVersion) return;
  referenceSource = null;
  renderReferenceTrack([], false);
  referenceStatus.textContent = 'Embedded subtitles could not be loaded.';
  referenceLoadStatus.textContent = error.message;
}

async function selectExperiment(run) {
  const version = ++selectionVersion;
  activeRunId = run.jobId;
  activeDecisionView = getDecisions(run).length ? 'archive' : 'pending';
  renderExperimentList();
  selectedExperiment.classList.remove('hidden');
  clearComparison();
  referenceOffset.disabled = false;
  referenceFile.disabled = false;
  attachReference.disabled = false;
  renderDecisionPanel(run);
  decisionStatus.textContent = '';
  decisionStatus.classList.remove('is-error');

  const summary = summarizeExperiment(run);
  selectedTitle.textContent = summary.title;
  selectedSource.textContent = run.metadata?.originalName || run.jobId;
  selectedState.textContent = run.status || 'saved';
  experimentWhat.textContent = summary.what;
  experimentWhy.textContent = summary.why;
  experimentBeforeAfter.textContent = `${summary.before} ${summary.after}`;
  experimentResult.textContent = summary.result;
  setStatus('Loading saved outputs…');
  updateReviewUrl();

  try {
    const runId = encodeURIComponent(run.jobId);
    const [a, b, reference] = await Promise.all([
      fetchJson(`/api/runs/${runId}/checkpoint/ab_a`),
      fetchJson(`/api/runs/${runId}/checkpoint/ab_b`),
      fetchJson(`/api/runs/${runId}/checkpoint/ab_reference`).catch(error => {
        if (error.status === 404) return null;
        throw error;
      })
    ]);
    if (version !== selectionVersion) return;

    aSegments = Array.isArray(a.segments) ? a.segments : [];
    bSegments = Array.isArray(b.segments) ? b.segments : [];
    const loadedSummary = summarizeExperiment(run, aSegments, bSegments);
    experimentResult.textContent = loadedSummary.result;
    countA.textContent = `${aSegments.length} ${aSegments.length === 1 ? 'cue' : 'cues'}`;
    countB.textContent = `${bSegments.length} ${bSegments.length === 1 ? 'cue' : 'cues'}`;
    transcriptStatus.textContent = `${aSegments.length} A cues · ${bSegments.length} B cues`;
    renderTrack(trackAList, aSegments, 'A');
    renderTrack(trackBList, bSegments, 'B');
    if (reference) showStoredReference(reference);

    const videoJobId = run.metadata?.videoJobId;
    if (videoJobId) {
      reviewVideo.controls = true;
      reviewVideo.src = `/api/stream/${encodeURIComponent(videoJobId)}`;
      reviewVideo.load();
      if (!reference) {
        try {
          await loadEmbeddedReference(run.jobId, version);
        } catch (referenceError) {
          showReferenceError(referenceError, version);
        }
      }
    } else {
      videoMessage.textContent = 'This experiment has no saved video reference. Its subtitle cues are still available below.';
      if (!reference) referenceStatus.textContent = 'No source video is available for embedded subtitles.';
    }
    updatePlayback();
    setStatus('');
  } catch (error) {
    if (version !== selectionVersion) return;
    videoMessage.textContent = 'Video unavailable; saved subtitle cues may still be listed below.';
    setStatus(`Could not load this experiment: ${error.message}`);
  }
}

async function loadExperiments() {
  const requestedId = new URLSearchParams(location.search).get('runId');
  experimentList.replaceChildren(Object.assign(document.createElement('p'), {
    className: 'loading-note', textContent: 'Loading saved experiments…'
  }));
  setStatus('');

  try {
    const data = await fetchJson('/api/runs');
    runs = (data.runs || [])
      .filter(run => run.metadata?.kind === 'ab-test')
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    if (!runs.length) {
      renderExperimentList();
      selectedExperiment.classList.add('hidden');
      clearComparison();
      setStatus('');
      return;
    }

    const chosen = requestedId
      ? runs.find(run => run.jobId === requestedId)
      : getVisibleRuns()[0];
    if (!chosen) {
      renderExperimentList();
      selectedExperiment.classList.add('hidden');
      clearComparison();
      setStatus(requestedId
        ? 'That saved experiment was not found. Choose one from the list above.'
        : '');
      return;
    }
    await selectExperiment(chosen);
  } catch (error) {
    experimentList.replaceChildren();
    const message = document.createElement('p');
    message.className = 'loading-note';
    message.textContent = 'Saved experiments could not be loaded.';
    experimentList.appendChild(message);
    setStatus(`Run history unavailable: ${error.message}`);
  }
}

for (const list of [trackAList, trackBList, trackReferenceList]) {
  list.addEventListener('click', event => {
    const button = event.target.closest('.cue-jump');
    if (!button) return;
    reviewVideo.currentTime = Number(button.dataset.start);
    updatePlayback();
  });
}

async function switchDecisionView(view) {
  activeDecisionView = view;
  const visibleRuns = getVisibleRuns();
  renderExperimentList();
  if (visibleRuns.some(run => run.jobId === activeRunId)) {
    updateReviewUrl();
    return;
  }
  if (visibleRuns[0]) {
    await selectExperiment(visibleRuns[0]);
    return;
  }
  activeRunId = null;
  selectedExperiment.classList.add('hidden');
  clearComparison();
  updateReviewUrl();
}

async function saveDecision(choice) {
  if (!activeRunId) return;
  const runId = activeRunId;
  decisionButtons.forEach(button => { button.disabled = true; });
  decisionStatus.classList.remove('is-error');
  decisionStatus.textContent = 'Saving decision…';

  try {
    const data = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice })
    });
    runs = runs.map(run => run.jobId === runId ? { ...run, decisions: data.decisions } : run);
    if (activeRunId === runId) {
      activeDecisionView = 'archive';
      renderDecisionPanel(runs.find(run => run.jobId === runId));
      updateReviewUrl();
      decisionStatus.textContent = 'Decision saved. Earlier timestamps are preserved.';
    }
    renderExperimentList();
  } catch (error) {
    if (activeRunId === runId) {
      decisionStatus.classList.add('is-error');
      decisionStatus.textContent = `Decision was not saved: ${error.message}`;
    }
  } finally {
    decisionButtons.forEach(button => { button.disabled = false; });
  }
}

reviewQueueButton.addEventListener('click', () => switchDecisionView('pending'));
decisionArchiveButton.addEventListener('click', () => switchDecisionView('archive'));
decisionButtons.forEach(button => button.addEventListener('click', () => saveDecision(button.dataset.decision)));

playbackTrack.addEventListener('change', updatePlayback);
referenceForm.addEventListener('submit', async event => {
  event.preventDefault();
  const file = referenceFile.files?.[0];
  if (!activeRunId || !file) return;

  const runId = activeRunId;
  const version = selectionVersion;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('offsetSeconds', referenceOffset.value || '0');
  attachReference.disabled = true;
  referenceLoadStatus.textContent = 'Attaching reference subtitles…';

  try {
    const data = await fetchJson(`/api/runs/${encodeURIComponent(runId)}/reference-subtitles`, {
      method: 'POST',
      body: formData
    });
    if (version !== selectionVersion) return;
    referenceFile.value = '';
    const run = runs.find(item => item.jobId === runId);
    if (run) await selectExperiment(run);
    if (activeRunId === runId) referenceLoadStatus.textContent = `${data.fileName} attached for comparison.`;
  } catch (error) {
    if (version === selectionVersion) referenceLoadStatus.textContent = error.message;
  } finally {
    attachReference.disabled = !activeRunId;
  }
});

referenceOffset.addEventListener('change', () => {
  if (!activeRunId || referenceOffset.disabled || referenceSource !== 'embedded') return;
  loadEmbeddedReference(activeRunId, selectionVersion)
    .catch(error => showReferenceError(error, selectionVersion));
});

reviewVideo.addEventListener('timeupdate', updatePlayback);
reviewVideo.addEventListener('seeked', updatePlayback);
reviewVideo.addEventListener('loadedmetadata', () => {
  videoMessage.classList.add('hidden');
  updatePlayback();
});
reviewVideo.addEventListener('durationchange', updatePlayback);
reviewVideo.addEventListener('error', () => {
  if (!reviewVideo.getAttribute('src')) return;
  videoMessage.classList.remove('hidden');
  videoMessage.textContent = 'The saved video could not be loaded. The subtitle transcripts remain available.';
});
document.getElementById('refreshExperiments').addEventListener('click', loadExperiments);
loadExperiments();
