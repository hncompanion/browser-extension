import { generateText } from 'ai';

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export async function summarizeText(data) {
    try {

        const { aiProvider, modelId, apiKey, systemPrompt, userPrompt, parameters = {} } = data;

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

            case 'openrouter':
                const openRouter = createOpenRouter({
                    apiKey: apiKey,
                });
                model = openRouter.chat(modelId);
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
            // Add optional parameters if provided
            // temperature: parameters.temperature || 0.7,
            top_p: parameters.top_p || 1,
            frequency_penalty: parameters.frequency_penalty || 0,
            presence_penalty: parameters.presence_penalty || 0,
            max_tokens: parameters.max_tokens
        });

        // console.log('Summarized text success. Summary:', summary);

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
        console.error(error);
        throw error;
    }
}