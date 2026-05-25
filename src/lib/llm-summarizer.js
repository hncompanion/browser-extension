import {generateText, streamText} from 'ai';

import {createOpenAI} from '@ai-sdk/openai';
import {createAnthropic} from '@ai-sdk/anthropic';
import {createGoogleGenerativeAI} from '@ai-sdk/google';
import {createOpenRouter} from '@openrouter/ai-sdk-provider';
import {Logger} from "./utils.js";

function createModel(aiProvider, modelId, apiKey) {
    switch (aiProvider) {
        case 'openai':
            return createOpenAI({ apiKey })(modelId);

        case 'anthropic':
            return createAnthropic({
                apiKey,
                headers: { 'anthropic-dangerous-direct-browser-access': 'true' },
            })(modelId);

        case 'google':
            return createGoogleGenerativeAI({ apiKey })(modelId);

        case 'openrouter':
            return createOpenRouter({ apiKey }).chat(modelId);

        default:
            throw new Error(`Unsupported AI provider: ${aiProvider}, model: ${modelId}`);
    }
}

function improveError(error, data) {
    const errorPrefix = `AI SDK API error. Reason: ${error.reason}. ` +
        `AI Provider: ${data?.aiProvider}, Model: ${data?.modelId}`;
    if (error instanceof Error) {
        error.message = `${errorPrefix} Message: ${error.message}`;
        return error;
    }
    return new Error(`${errorPrefix}. Message: ${String(error)}`);
}

export async function summarizeText(data) {
    try {
        const { aiProvider, modelId, apiKey, systemPrompt, userPrompt, parameters = {} } = data;

        const model = createModel(aiProvider, modelId, apiKey);
        if (!model) {
            throw new Error(`Failed to initialize model for provider: ${aiProvider}, model: ${modelId}`);
        }

        const { text: summary } = await generateText({
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

export async function streamSummarizeText(data, onChunk, onDone, onError, abortSignal) {
    try {
        const { aiProvider, modelId, apiKey, systemPrompt, userPrompt, parameters = {} } = data;

        const model = createModel(aiProvider, modelId, apiKey);
        if (!model) {
            throw new Error(`Failed to initialize model for provider: ${aiProvider}, model: ${modelId}`);
        }

        const result = streamText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: parameters.temperature,
            topP: parameters.topP,
            frequencyPenalty: parameters.frequencyPenalty,
            presencePenalty: parameters.presencePenalty,
            maxOutputTokens: parameters.maxOutputTokens,
            abortSignal
        });

        for await (const delta of result.textStream) {
            if (abortSignal?.aborted) break;
            onChunk(delta);
        }

        const fullText = await result.text;
        onDone(fullText);

    } catch (caughtError) {
        if (abortSignal?.aborted) return;
        const error = improveError(caughtError, data);
        await Logger.error(error);
        onError(error);
    }
}
