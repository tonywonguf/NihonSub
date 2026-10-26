import { formatTime, getActiveCue, summarizeExperiment } from './ab-review-data.js';

const experimentList = document.getElementById('experimentList');
const experimentCount = document.getElementById('experimentCount');
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
const referenceUploadStatus = document.getElementById('referenceUploadStatus');
const attachReference = document.getElementById('attachReference');
const playbackTrack = document.getElementById('playbackTrack');
const referenceTrackOption = playbackTrack.querySelector('option[value="reference"]');
const transcriptStatus = document.getElementById('transcriptStatus');

let runs = [];
let activeRunId = null;
let aSegments = [];
let bSegments = [];
let referenceSegments = [];
let selectionVersion = 0;

async function fetchJson(url) {
  const response = await fetch(url);
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

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Saved run' : date.toLocaleDateString();
}

function renderExperimentList() {
  experimentList.replaceChildren();
  experimentCount.textContent = `${runs.length} saved`;

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

  for (const run of runs) {
    const summary = summarizeExperiment(run);
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
    state.textContent = run.status || 'saved';

    const copy = document.createElement('span');
    copy.className = 'option-copy';
    for (const [label, value] of [['What', summary.what], ['Why', summary.why]]) {
      const line = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `${label}: `;
      line.append(strong, document.createTextNode(value));
      copy.appendChild(line);
    }

    button.append(titleRow, state, copy);
    button.addEventListener('click', () => selectExperiment(run));
    experimentList.appendChild(button);
  }
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
  referenceStatus.textContent = 'No reference attached.';
  referenceFile.value = '';
  referenceOffset.value = '0';
  referenceUploadStatus.textContent = '';
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
  videoMessage.textContent = 'Loading the saved video and subtitle tracks…';
  videoDuration.textContent = '--:--.--';
  timePlayhead.style.left = '0%';
}

async function selectExperiment(run) {
  const version = ++selectionVersion;
  activeRunId = run.jobId;
  renderExperimentList();
  selectedExperiment.classList.remove('hidden');
  clearComparison();

  const summary = summarizeExperiment(run);
  selectedTitle.textContent = summary.title;
  selectedSource.textContent = run.metadata?.originalName || run.jobId;
  selectedState.textContent = run.status || 'saved';
  experimentWhat.textContent = summary.what;
  experimentWhy.textContent = summary.why;
  experimentBeforeAfter.textContent = `${summary.before} ${summary.after}`;
  experimentResult.textContent = summary.result;
  setStatus('Loading saved outputs…');
  history.replaceState(null, '', `?runId=${encodeURIComponent(run.jobId)}`);

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
    referenceSegments = Array.isArray(reference?.segments) ? reference.segments : [];
    trackReferenceColumn.hidden = !reference;
    transcriptGrid.classList.toggle('has-reference', Boolean(reference));
    referenceTrackOption.disabled = !reference;
    referenceOffset.value = String(reference?.offsetSeconds ?? 0);
    referenceStatus.textContent = reference
      ? `${reference.fileName || 'Reference file'} · ${referenceSegments.length} cues · offset ${reference.offsetSeconds >= 0 ? '+' : ''}${reference.offsetSeconds}s`
      : 'No reference attached.';
    const loadedSummary = summarizeExperiment(run, aSegments, bSegments);
    experimentResult.textContent = loadedSummary.result;
    countA.textContent = `${aSegments.length} ${aSegments.length === 1 ? 'cue' : 'cues'}`;
    countB.textContent = `${bSegments.length} ${bSegments.length === 1 ? 'cue' : 'cues'}`;
    transcriptStatus.textContent = `${aSegments.length} A cues · ${bSegments.length} B cues`;
    renderTrack(trackAList, aSegments, 'A');
    renderTrack(trackBList, bSegments, 'B');
    countReference.textContent = `${referenceSegments.length} ${referenceSegments.length === 1 ? 'cue' : 'cues'}`;
    renderTrack(trackReferenceList, referenceSegments, 'Reference');

    const videoJobId = run.metadata?.videoJobId;
    if (videoJobId) {
      reviewVideo.controls = true;
      reviewVideo.src = `/api/stream/${encodeURIComponent(videoJobId)}`;
      reviewVideo.load();
    } else {
      videoMessage.textContent = 'This experiment has no saved video reference. Its subtitle cues are still available below.';
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
    renderExperimentList();

    if (!runs.length) {
      selectedExperiment.classList.add('hidden');
      setStatus('');
      return;
    }

    const chosen = requestedId
      ? runs.find(run => run.jobId === requestedId)
      : runs[0];
    if (!chosen) {
      selectedExperiment.classList.add('hidden');
      setStatus('That saved experiment was not found. Choose one from the list above.');
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
  referenceUploadStatus.textContent = 'Attaching reference subtitles…';

  try {
    const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/reference-subtitles`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    if (version !== selectionVersion) return;

    await selectExperiment(runs.find(run => run.jobId === runId));
    referenceUploadStatus.textContent = `${data.fileName} attached for comparison.`;
  } catch (error) {
    if (version === selectionVersion) referenceUploadStatus.textContent = error.message;
  } finally {
    attachReference.disabled = false;
  }
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
