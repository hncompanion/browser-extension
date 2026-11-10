import {generateText, streamText} from 'ai';

import {createOpenAI} from '@ai-sdk/openai';
import {createAnthropic} from '@ai-sdk/anthropic';
import {createGoogleGenerativeAI} from '@ai-sdk/google';
import {Logger} from "./utils.js";

const OPENAI_COMPATIBLE_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function createModel({aiProvider, modelId, apiKey, baseURL}) {
    switch (aiProvider) {
        case 'openai':
            return createOpenAI({apiKey})(modelId);

        case 'anthropic':
            return createAnthropic({
                apiKey,
                headers: {'anthropic-dangerous-direct-browser-access': 'true'},
            })(modelId);

        case 'google':
            return createGoogleGenerativeAI({apiKey})(modelId);

        // 'openai-compatible' covers supported OpenAI Chat Completions
        // endpoints (OpenRouter, Groq, Together, or localhost /v1 servers).
        // 'openrouter' is kept as a legacy alias for settings saved before
        // the providers were unified.
        case 'openai-compatible':
        case 'openrouter': {
            const compatibleBaseURL = baseURL || (aiProvider === 'openrouter' ? OPENAI_COMPATIBLE_OPENROUTER_BASE_URL : '');
            if (!compatibleBaseURL) {
                throw new Error('Missing Base URL for OpenAI-compatible provider');
            }
            const compatible = createOpenAI({
                // Some local servers (llama.cpp, LM Studio) don't require a key;
                // the SDK still needs a non-empty value, so fall back to a placeholder.
                apiKey: apiKey || 'not-needed',
                baseURL: compatibleBaseURL,
            });
            return compatible.chat(modelId);
        }

        default:
            throw new Error(`Unsupported AI provider: ${aiProvider}, model: ${modelId}`);
    }
}

// No streamed output for this long means the provider has stalled. Reasoning
// models can be quiet for a while before the first token, so keep it generous.
const STREAM_IDLE_TIMEOUT_MS = 120_000;

function improveError(error, data) {
    // The SDK retries 429/5xx responses and then wraps the failure in a
    // RetryError; the HTTP status lives on the last attempt's error.
    const statusCode = error?.statusCode ?? error?.lastError?.statusCode;
    const errorPrefix = `AI SDK API error${statusCode ? ` (HTTP ${statusCode})` : ''}. ` +
        `AI Provider: ${data?.aiProvider}, Model: ${data?.modelId}.`;
    if (error instanceof Error) {
        error.message = `${errorPrefix} Message: ${error.message}`;
        return error;
    }
    return new Error(`${errorPrefix} Message: ${String(error)}`);
}

export async function summarizeText(data) {
    try {
        const {systemPrompt, userPrompt, parameters = {}} = data;

        const model = createModel(data);
        if (!model) {
            throw new Error(`Failed to initialize model for provider: ${data.aiProvider}, model: ${data.modelId}`);
        }

        const {text: summary} = await generateText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: parameters.temperature,
            topP: parameters.topP,
            frequencyPenalty: parameters.frequencyPenalty,
            presencePenalty: parameters.presencePenalty,
            maxOutputTokens: parameters.maxOutputTokens
        });

        await Logger.debug('Summarized text success. Summary:', summary);
        return summary;

    } catch (caughtError) {
        const error = improveError(caughtError, data);
        await Logger.error(error);
        throw error;
    }
}

export async function streamSummarizeText(data, onChunk, onDone, onError, abortSignal, {idleTimeoutMs = STREAM_IDLE_TIMEOUT_MS} = {}) {
    try {
        const {systemPrompt, userPrompt, parameters = {}} = data;

        const model = createModel(data);
        if (!model) {
            throw new Error(`Failed to initialize model for provider: ${data.aiProvider}, model: ${data.modelId}`);
        }

        // streamText does not throw provider failures (bad key, rate limit,
        // quota): textStream just ends and result.text rejects with a generic
        // "No output generated" error. Capture the real error via onError so
        // the user sees what actually went wrong.
        let streamError = null;
        let abortedBySdk = false;

        const result = streamText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: parameters.temperature,
            topP: parameters.topP,
            frequencyPenalty: parameters.frequencyPenalty,
            presencePenalty: parameters.presencePenalty,
            maxOutputTokens: parameters.maxOutputTokens,
            abortSignal,
            timeout: {chunkMs: idleTimeoutMs},
            onError: ({error}) => {
                streamError ??= error;
            },
            onAbort: () => {
                abortedBySdk = true;
            }
        });

        for await (const delta of result.textStream) {
            if (abortSignal?.aborted) break;
            onChunk(delta);
        }

        let fullText;
        try {
            fullText = await result.text;
        } catch (textError) {
            // An abort we did not request is the idle timeout firing; the SDK
            // only reports it as a bare "This operation was aborted".
            if (!streamError && abortedBySdk && !abortSignal?.aborted) {
                throw new Error(`Request timed out: no output from the AI provider for ${Math.round(idleTimeoutMs / 1000)}s.`);
            }
            throw streamError ?? textError;
        }
        if (streamError) throw streamError;
        onDone(fullText);

    } catch (caughtError) {
        if (abortSignal?.aborted) return;
        const error = improveError(caughtError, data);
        await Logger.error(error);
        onError(error);
    }
}
