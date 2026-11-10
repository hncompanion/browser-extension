import './helpers/stub-wxt-imports.js';

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

const { streamSummarizeText } = await import('../src/lib/llm-summarizer.js');

// Minimal OpenAI-compatible Chat Completions server. The requested model id
// selects the behavior.
let server;
let baseURL;

before(async () => {
    server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            const { model } = JSON.parse(body || '{}');
            if (model === 'bad-key') {
                res.writeHead(401, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } }));
                return;
            }
            if (model === 'no-credit') {
                res.writeHead(402, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ error: { message: 'You exceeded your current quota', type: 'insufficient_quota' } }));
                return;
            }
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            if (model === 'stall') {
                // Send headers and then nothing, like a hung provider.
                res.flushHeaders();
                return;
            }
            const chunk = (delta, finish = null) => `data: ${JSON.stringify({
                id: 'c1', object: 'chat.completion.chunk', created: 1, model,
                choices: [{ index: 0, delta, finish_reason: finish }],
            })}\n\n`;
            res.write(chunk({ role: 'assistant', content: 'Hello' }));
            res.write(chunk({ content: ' world' }));
            res.write(chunk({}, 'stop'));
            res.end('data: [DONE]\n\n');
        });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseURL = `http://127.0.0.1:${server.address().port}/v1`;
});

after(() => {
    server.closeAllConnections();
    server.close();
});

function run(modelId, options) {
    return new Promise((resolve) => {
        const chunks = [];
        streamSummarizeText(
            { aiProvider: 'openai-compatible', modelId, apiKey: 'test', baseURL, systemPrompt: 'sys', userPrompt: 'user' },
            (delta) => chunks.push(delta),
            (text) => resolve({ chunks, text }),
            (error) => resolve({ chunks, error }),
            undefined,
            options,
        );
    });
}

test('streams chunks and reports the full text', async () => {
    const result = await run('ok');
    assert.strictEqual(result.error, undefined);
    assert.deepStrictEqual(result.chunks, ['Hello', ' world']);
    assert.strictEqual(result.text, 'Hello world');
});

test('an authentication failure surfaces the provider error and HTTP status', async () => {
    const { error } = await run('bad-key');
    assert.ok(error, 'expected onError to be called');
    assert.match(error.message, /HTTP 401/);
    assert.match(error.message, /Incorrect API key provided/);
    assert.doesNotMatch(error.message, /No output generated/);
    assert.doesNotMatch(error.message, /undefined/);
});

test('a quota failure surfaces the provider message', async () => {
    const { error } = await run('no-credit');
    assert.ok(error, 'expected onError to be called');
    assert.match(error.message, /HTTP 402/);
    assert.match(error.message, /current quota/);
});

test('a stalled stream ends with a timeout error instead of hanging', async () => {
    const { error } = await run('stall', { idleTimeoutMs: 300 });
    assert.ok(error, 'expected onError to be called');
    assert.match(error.message, /timed out/);
});
