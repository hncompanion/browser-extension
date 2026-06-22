import {generateText} from 'ai';

import {createOpenAI} from '@ai-sdk/openai';
import {createAnthropic} from '@ai-sdk/anthropic';
import {createGoogleGenerativeAI} from '@ai-sdk/google';
import {Logger} from "./utils.js";

const OPENAI_COMPATIBLE_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export async function summarizeText(data) {
    try {

        const { aiProvider, modelId, apiKey, baseURL, systemPrompt, userPrompt, parameters = {} } = data;

        let model;
        switch (aiProvider) {
            // AI provider can be 'openai', 'anthropic', 'google' or 'openrouter'
            case 'openai':
                const openai = createOpenAI({
                    apiKey: apiKey,
                });
                model = openai(modelId);
                break;

            case 'anthropic':
                const anthropic = createAnthropic({
                    apiKey: apiKey,
                    headers: {
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                });
                model = anthropic(modelId);
                break;

            case 'google':
                const google = createGoogleGenerativeAI({
                    apiKey: apiKey,
                });
                model = google(modelId);
                break;

            // 'openai-compatible' covers supported OpenAI Chat Completions
            // endpoints (OpenRouter, Groq, Together, or localhost /v1 servers).
            // 'openrouter' is kept as a legacy alias for settings saved before
            // the providers were unified.
            case 'openai-compatible':
            case 'openrouter':
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
                model = compatible.chat(modelId);
                break;

            default:
                throw new Error(`Unsupported AI provider: ${aiProvider}, model: ${modelId}`);
        }
        if (!model) {
            throw new Error(`Failed to initialize model for provider: ${aiProvider}, model: ${modelId}`);
        }

        const { text: summary } = await generateText({
            model: model,
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
        const improveError = (error) => {
            const errorPrefix = `AI SDK API generateText() threw error. Reason: ${error.reason}. ` +
                `AI Provider: ${data?.aiProvider}, Model: ${data?.modelId}`;
            if (error instanceof Error) {
                error.message = `${errorPrefix} Message: ${error.message}`;
                return  error;
            }
            return  new Error(`${errorPrefix}. Message: ${String(error)}`);
        }
        const error = improveError(caughtError);
        await Logger.error(error);
        throw error;
    }
}
