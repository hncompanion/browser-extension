#!/usr/bin/env node
// Validates the hand-maintained OpenAI-compatible provider presets against
// models.dev.
//
//   node scripts/providers.js --check    validate presets and suggested models (CI)
//
// models.dev is a build-time data source only; the extension never fetches it
// at runtime, and host permissions stay checked in (host-permissions.js).

import {OPENAI_COMPATIBLE_PROVIDERS} from '../src/lib/openai-compatible-providers.js';
import {originPatternFromUrl, isSupportedOpenAICompatibleOrigin} from '../src/lib/host-permissions.js';

const MODELS_DEV_API = 'https://models.dev/api.json';
const MIN_CONTEXT = 8192;
const DISALLOWED_MODEL_PATTERN = /image|audio|voice|whisper|guard|safety|embed|rerank|ocr|moderation|vision|transcrib|tts|video/i;
const SUPPORTED_API_SURFACES = new Set(['chat-completions']);

function isChatModel(model) {
    const inputs = model.modalities?.input || [];
    const outputs = model.modalities?.output || [];
    const context = model.limit?.context || 0;
    const output = model.limit?.output || 0;
    return inputs.includes('text') && outputs.includes('text')
        && context >= MIN_CONTEXT && output > 0;
}

function validate(modelsDev) {
    const problems = [];
    const seenIds = new Set();
    for (const provider of OPENAI_COMPATIBLE_PROVIDERS) {
        if (seenIds.has(provider.id)) {
            problems.push(`${provider.id}: duplicate preset id`);
        }
        seenIds.add(provider.id);
        if (!SUPPORTED_API_SURFACES.has(provider.apiSurface)) {
            problems.push(`${provider.id}: unsupported apiSurface '${provider.apiSurface}'`);
        }

        const pattern = originPatternFromUrl(provider.baseURL);
        if (!pattern || !isSupportedOpenAICompatibleOrigin(pattern)) {
            problems.push(`${provider.id}: baseURL origin ${pattern || provider.baseURL} is not in OPENAI_COMPATIBLE_PERMISSION_ORIGINS (host-permissions.js)`);
        }
        for (const urlField of ['keysUrl', 'docsUrl']) {
            try {
                if (provider[urlField]) new URL(provider[urlField]);
            } catch {
                problems.push(`${provider.id}: ${urlField} is not a valid URL`);
            }
        }

        const suggestedModels = provider.suggestedModels || [];
        const seenModels = new Set();
        for (const model of suggestedModels) {
            if (!model.id || typeof model.id !== 'string') {
                problems.push(`${provider.id}: suggested model is missing an id`);
            }
            if (seenModels.has(model.id)) {
                problems.push(`${provider.id}: duplicate suggested model '${model.id}'`);
            }
            seenModels.add(model.id);
            if (!model.name || typeof model.name !== 'string') {
                problems.push(`${provider.id}/${model.id}: suggested model is missing a name`);
            }
            if (!(model.context >= MIN_CONTEXT)) {
                problems.push(`${provider.id}/${model.id}: context must be at least ${MIN_CONTEXT}`);
            }
            if (!(model.output > 0)) {
                problems.push(`${provider.id}/${model.id}: output must be positive`);
            }
            if (DISALLOWED_MODEL_PATTERN.test(`${model.id} ${model.name}`)) {
                problems.push(`${provider.id}/${model.id}: suggested model looks like a non-chat/special-purpose model`);
            }
        }

        if (!provider.modelsDevId) continue;
        const entry = modelsDev[provider.modelsDevId];
        if (!entry) {
            problems.push(`${provider.id}: models.dev has no provider '${provider.modelsDevId}'`);
            continue;
        }
        if (entry.api) {
            const theirOrigin = originPatternFromUrl(entry.api);
            if (theirOrigin && theirOrigin !== pattern) {
                problems.push(`${provider.id}: models.dev api origin ${theirOrigin} differs from ours ${pattern} — the endpoint may have moved`);
            }
        }

        for (const model of suggestedModels) {
            const modelsDevModel = entry.models?.[model.id];
            if (!modelsDevModel) {
                problems.push(`${provider.id}/${model.id}: suggested model is missing from models.dev provider '${provider.modelsDevId}'`);
                continue;
            }
            if (!isChatModel(modelsDevModel)) {
                problems.push(`${provider.id}/${model.id}: models.dev does not describe this as a sane text chat model`);
            }
            if (modelsDevModel.provider?.shape === 'responses' && provider.apiSurface === 'chat-completions') {
                problems.push(`${provider.id}/${model.id}: models.dev marks this model as Responses API only, but runtime only supports Chat Completions`);
            }
        }
    }
    return problems;
}

async function main() {
    const mode = process.argv[2];
    if (mode !== '--check') {
        console.error('Usage: node scripts/providers.js --check');
        process.exit(2);
    }

    const response = await fetch(MODELS_DEV_API);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${MODELS_DEV_API}: HTTP ${response.status}`);
    }
    const modelsDev = await response.json();

    const problems = validate(modelsDev);

    if (problems.length > 0) {
        console.error('Provider validation failed:');
        for (const problem of problems) {
            console.error(`  - ${problem}`);
        }
        process.exit(1);
    }
    console.log(`OK: ${OPENAI_COMPATIBLE_PROVIDERS.length} presets validated`);
}

await main();
