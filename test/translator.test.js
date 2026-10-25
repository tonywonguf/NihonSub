import assert from 'node:assert/strict';
import test from 'node:test';
import { translateSegments } from '../translator.js';

test('translation requests prioritize source accuracy over stylistic embellishment', async () => {
  const originalFetch = globalThis.fetch;
  let systemPrompt;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    systemPrompt = request.messages.find(message => message.role === 'system').content;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify([{ id: 7, start: 2.5, end: 4, english_text: 'It starts now.' }]) } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    await translateSegments(
      [{ id: 7, start: 2.5, end: 4, text: '始まる。' }],
      'en',
      [{ name: 'test', baseUrl: 'http://local.test/v1', model: 'test', apiKey: 'x' }],
      null, null, null, null, null, null, 'fallback'
    );
    assert.match(systemPrompt, /japanese_text" is the source of truth/i);
    assert.match(systemPrompt, /audio_acoustic_translation" is secondary evidence/i);
    assert.match(systemPrompt, /do not add content not supported by the Japanese text/i);
    assert.match(systemPrompt, /accuracy before style/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('accepts Qwen responses using english_text and preserves segment timing', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify([{
          id: 7,
          start: 2.5,
          end: 4,
          english_text: 'It starts now.'
        }])
      }
    }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  try {
    const result = await translateSegments(
      [{ id: 7, start: 2.5, end: 4, text: '始まる。' }],
      'en',
      [{ name: 'test', baseUrl: 'http://local.test/v1', model: 'test', apiKey: 'x' }],
      null, null, null, null, null, null, 'fallback'
    );
    assert.deepEqual(result, [{ id: 7, start: 2.5, end: 4, text: 'It starts now.' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('past-only mode gives each translation only its current and preceding segments', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const prompt = request.messages.find(message => message.role === 'user').content;
    const batch = JSON.parse(prompt.split('JSON SEGMENTS TO TRANSLATE:\n')[1]);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(batch.map(segment => ({ id: segment.id, text: `English ${segment.id}` }))) } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const result = await translateSegments(
      [
        { id: 0, start: 0, end: 1, text: '最初の台詞' },
        { id: 1, start: 1, end: 2, text: '次の台詞' },
        { id: 2, start: 2, end: 3, text: '未来の台詞' }
      ],
      'en',
      [{ name: 'test', baseUrl: 'http://local.test/v1', model: 'test', apiKey: 'x' }],
      null, null, null, null, null, null, 'fallback',
      { pastOnly: true, batchSize: 1 }
    );

    assert.equal(result.length, 3);
    assert.equal(requests.length, 3);
    assert.doesNotMatch(requests[0].messages[1].content, /次の台詞|未来の台詞/);
    assert.match(requests[1].messages[1].content, /最初の台詞/);
    assert.doesNotMatch(requests[1].messages[1].content, /未来の台詞/);
    assert.doesNotMatch(requests[0].messages[0].content, /GLOBAL EPISODE CONTEXT/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resumes from completed translation batches and checkpoints each new batch', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const checkpoints = [];
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const prompt = request.messages.find(message => message.role === 'user').content;
    const batch = JSON.parse(prompt.split('JSON SEGMENTS TO TRANSLATE:\n')[1]);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(batch.map(segment => ({ id: segment.id, text: `English ${segment.id}` }))) } }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const result = await translateSegments(
      [
        { id: 0, start: 0, end: 1, text: '最初の台詞' },
        { id: 1, start: 1, end: 2, text: '次の台詞' },
        { id: 2, start: 2, end: 3, text: '最後の台詞' }
      ],
      'en',
      [{ name: 'test', baseUrl: 'http://local.test/v1', model: 'test', apiKey: 'x' }],
      null, null, null, null, null, null, 'fallback',
      {
        pastOnly: true,
        batchSize: 1,
        completedResults: [{ id: 0, start: 0, end: 1, text: 'Saved translation' }],
        onBatchComplete: results => checkpoints.push(results.map(segment => segment.text))
      }
    );

    assert.equal(requests.length, 2);
    assert.equal(result[0].text, 'Saved translation');
    assert.deepEqual(checkpoints, [
      ['Saved translation', 'English 1'],
      ['Saved translation', 'English 1', 'English 2']
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects untranslated fallbacks when the provider omits translation text', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify([{ id: 7, start: 2.5, end: 4, notes: 'missing text' }]) } }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  try {
    await assert.rejects(
      translateSegments(
        [{ id: 7, start: 2.5, end: 4, text: '始まる。' }],
        'en',
        [{ name: 'test', baseUrl: 'http://local.test/v1', model: 'test', apiKey: 'x' }],
        null, null, null, null, null, null, 'fallback'
      ),
      /no text for segment 7/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
