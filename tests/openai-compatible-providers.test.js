import { test } from 'node:test';
import assert from 'node:assert';

import { OPENAI_COMPATIBLE_PROVIDERS } from '../src/lib/openai-compatible-providers.js';
import { originPatternFromUrl, isSupportedOpenAICompatibleOrigin } from '../src/lib/host-permissions.js';

const MIN_CONTEXT = 8192;
const DISALLOWED_MODEL_PATTERN = /image|audio|voice|whisper|guard|safety|embed|rerank|ocr|moderation|vision|transcrib|tts|video/i;
const SUPPORTED_API_SURFACES = new Set(['chat-completions']);

test('provider preset ids are unique and never collide with the custom preset', () => {
    const ids = OPENAI_COMPATIBLE_PROVIDERS.map((p) => p.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'duplicate preset id');
    assert.ok(!ids.includes('custom'), "preset id 'custom' is reserved for the manual option");
});

test('every preset baseURL origin is covered by the permission allowlist', () => {
    for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
        const pattern = originPatternFromUrl(provider.baseURL);
        assert.ok(pattern, `${provider.id}: baseURL ${provider.baseURL} is not a valid http(s) URL`);
        assert.ok(
            isSupportedOpenAICompatibleOrigin(pattern),
            `${provider.id}: origin ${pattern} missing from OPENAI_COMPATIBLE_PERMISSION_ORIGINS`
        );
    }
});

test('every preset declares a supported API surface', () => {
    for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
        assert.ok(
            SUPPORTED_API_SURFACES.has(provider.apiSurface),
            `${provider.id}: unsupported apiSurface ${provider.apiSurface}`
        );
    }
});

test('suggested models are curated chat/text entries with sane limits', () => {
    for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
        const seenModels = new Set();
        for (const model of provider.suggestedModels || []) {
            assert.ok(model.id && typeof model.id === 'string', `${provider.id}: model without id`);
            assert.ok(!seenModels.has(model.id), `${provider.id}: duplicate suggested model ${model.id}`);
            seenModels.add(model.id);
            assert.ok(model.name && typeof model.name === 'string', `${provider.id}/${model.id}: model without name`);
            assert.ok(model.context >= MIN_CONTEXT, `${provider.id}/${model.id}: context below ${MIN_CONTEXT}`);
            assert.ok(model.output > 0, `${provider.id}/${model.id}: non-positive output limit`);
            assert.ok(
                !DISALLOWED_MODEL_PATTERN.test(`${model.id} ${model.name}`),
                `${provider.id}/${model.id}: looks like a non-chat/special-purpose model`
            );
        }
    }
});

test('models.dev-backed presets declare at least one suggested model', () => {
    for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
        if (!provider.modelsDevId) continue;
        assert.ok(provider.suggestedModels?.length > 0, `${provider.id}: missing suggested models`);
    }
});
