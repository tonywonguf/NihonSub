import { spawn } from 'node:child_process';
import fs from 'node:fs';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CUES = 20_000;
const MAX_OFFSET_SECONDS = 7 * 24 * 60 * 60;
const TEXT_SUBTITLE_CODECS = new Set(['ass', 'microdvd', 'mov_text', 'sami', 'ssa', 'subrip', 'text', 'webvtt']);

function resolveMediaTool(envVar, binaryName) {
  const configured = process.env[envVar];
  return configured && fs.existsSync(configured) ? configured : binaryName;
}

function parseTimestamp(value) {
  const parts = value.replace(',', '.').split(':');
  const time = parts.pop();
  const minutesText = parts.pop();
  const hoursText = parts.pop();
  if (parts.length || !minutesText || !/^\d+$/.test(minutesText)) return null;

  const match = time.match(/^(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const hours = hoursText === undefined ? 0 : Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(match[1]);
  if (!Number.isFinite(hours) || (hoursText !== undefined && minutes > 59) || seconds > 59) return null;

  const milliseconds = Number((match[2] || '').padEnd(3, '0'));
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    if (code[0] !== '#') {
      return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' })[code.toLowerCase()] || entity;
    }
    const point = code[1]?.toLowerCase() === 'x'
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    return Number.isInteger(point) && point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point)
      : '\ufffd';
  });
}

export function parseReferenceSubtitles(content, { offsetSeconds = 0 } = {}) {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
    throw new Error('Subtitle file must be text smaller than 5 MB.');
  }
  if (!Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) > MAX_OFFSET_SECONDS) {
    throw new Error('Time offset must be a finite number within seven days.');
  }

  const normalized = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^WEBVTT[^\n]*\n/i, '');
  const cues = [];
  let validCueCount = 0;

  for (const block of normalized.split(/\n[\t ]*\n+/)) {
    const lines = block.split('\n');
    const firstLine = lines.find(line => line.trim())?.trim() || '';
    if (/^(?:NOTE|STYLE|REGION)(?:\s|$)/i.test(firstLine)) continue;

    const timingIndex = lines.findIndex(line => line.includes('-->'));
    if (timingIndex < 0) continue;
    const timing = lines[timingIndex].trim().match(/^(\S+)\s*-->\s*(\S+)(?:\s+.*)?$/);
    const start = timing && parseTimestamp(timing[1]);
    const end = timing && parseTimestamp(timing[2]);
    if (start === null || start === undefined || end === null || end === undefined || end <= start) {
      throw new Error('Invalid subtitle timing.');
    }

    const text = decodeEntities(lines.slice(timingIndex + 1).join('\n').replace(/<[^>]*>/g, '').trim());
    if (!text) continue;

    validCueCount++;
    const shiftedStart = Math.max(0, Math.round((start + offsetSeconds) * 1000) / 1000);
    const shiftedEnd = Math.round((end + offsetSeconds) * 1000) / 1000;
    if (shiftedEnd <= shiftedStart) continue;
    cues.push({ id: cues.length, start: shiftedStart, end: shiftedEnd, text });
    if (cues.length > MAX_CUES) throw new Error('Subtitle file contains too many cues.');
  }

  if (!cues.length && !validCueCount) throw new Error('No valid subtitle cues found.');
  return cues;
}

export function chooseDefaultSubtitleTrack(tracks) {
  const englishTracks = tracks.filter(track => {
    const language = String(track.language || '').toLowerCase();
    return ['en', 'eng'].includes(language) || language.startsWith('en-') || /\benglish\b/i.test(track.title || '');
  });
  const candidates = englishTracks.length ? englishTracks : tracks;
  return candidates.find(track => track.default) || candidates[0] || null;
}

function runMediaTool(command, args, maxOutputBytes) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let outputBytes = 0;
    let stderr = '';
    let outputTooLarge = false;

    proc.stdout.on('data', chunk => {
      if (outputTooLarge) return;
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        outputTooLarge = true;
        proc.kill();
        return;
      }
      chunks.push(chunk);
    });
    proc.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-2000); });
    proc.once('error', error => reject(new Error(`Could not run ${command}: ${error.message}`)));
    proc.once('close', code => {
      if (outputTooLarge) return reject(new Error('Embedded subtitle output exceeds 5 MB.'));
      if (code !== 0) return reject(new Error(stderr.trim() || `${command} exited with code ${code}.`));
      return resolve(Buffer.concat(chunks));
    });
  });
}

// shortcut: image-based subtitle streams require OCR; add OCR if a source only contains bitmap subtitles.
export async function getEmbeddedSubtitleTracks(videoPath) {
  const output = await runMediaTool(resolveMediaTool('FFPROBE_PATH', 'ffprobe'), [
    '-v', 'error',
    '-select_streams', 's',
    '-show_entries', 'stream=index,codec_name:stream_tags=language,title:stream_disposition=default',
    '-of', 'json',
    videoPath
  ], 1024 * 1024);
  const parsed = JSON.parse(output.toString('utf8'));
  return (parsed.streams || [])
    .filter(stream => TEXT_SUBTITLE_CODECS.has(stream.codec_name))
    .map(stream => ({
      index: stream.index,
      codec: stream.codec_name,
      language: stream.tags?.language || '',
      title: stream.tags?.title || '',
      default: stream.disposition?.default === 1
    }));
}

export async function extractEmbeddedSubtitleTrack(videoPath, streamIndex) {
  if (!Number.isSafeInteger(streamIndex) || streamIndex < 0) throw new Error('Invalid subtitle track index.');
  const output = await runMediaTool(resolveMediaTool('FFMPEG_PATH', 'ffmpeg'), [
    '-nostdin', '-v', 'error', '-i', videoPath,
    '-map', `0:${streamIndex}`,
    '-c:s', 'srt', '-f', 'srt', 'pipe:1'
  ], MAX_FILE_BYTES);
  return output.toString('utf8');
}
