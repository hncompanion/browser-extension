/**
 * AI Summarizer Module
 * All AI summarization logic including provider configuration and error handling.
 */

import {storage} from '#imports';
import {Logger} from "../../lib/utils.js";
import {sendBackgroundMessage} from "../../lib/messaging.js";
import {AI_SYSTEM_PROMPT, AI_USER_PROMPT_TEMPLATE} from './constants.js';
// Import generic utilities from lib
import {buildFragment, createStrong, createInternalLink, createExternalLink} from '../../lib/dom-utils.js';
import {stripAnchors, splitInputTextAtTokenLimit} from '../../lib/text-utils.js';

// Import HN-specific DOM utilities
import {createHighlightedAuthor, createLoadingMessage} from './hn-dom-utils.js';
import {getHNThread, createSummaryFragment} from './comment-processor.js';

/**
 * Status codes for summarization validation.
 */
export const SummarizeCheckStatus = {
    OK: 'ok',
    TEXT_TOO_SHORT: 'too_short',
    THREAD_TOO_SHALLOW: 'too_shallow',
    THREAD_TOO_DEEP: 'chrome_depth_limit'
};

/**
 * Gets the AI provider and model from settings.
 * @returns {Promise<{aiProvider: string, model: string}>}
 */
export async function getAIProviderModel() {
    const settings = await storage.getItem('sync:settings');
    const aiProvider = settings?.providerSelection;
    const model = settings?.[aiProvider]?.model;
    return {aiProvider, model};
}

/**
 * Gets the system message for AI summarization.
 * @returns {Promise<string>}
 */
export async function getSystemMessage() {
    const settings = await storage.getItem('sync:settings') || {};
    if (settings.promptCustomization && settings.systemPrompt) {
        return settings.systemPrompt;
    }
    return AI_SYSTEM_PROMPT;
}

/**
 * Gets the user message for AI summarization.
 * @param {string} title - Post title
 * @param {string} text - Text to summarize
 * @returns {Promise<string>}
 */
export async function getUserMessage(title, text) {
    const settings = await storage.getItem('sync:settings') || {};
    if (settings.promptCustomization && settings.userPrompt) {
        return settings.userPrompt.replace(/\$\{title}/g, title).replace(/\$\{text}/g, text);
    }
    return AI_USER_PROMPT_TEMPLATE(title, text);
}

/**
 * Gets model-specific configuration.
 * @param {string} provider - AI provider name
 * @param {string} modelId - Model ID
 * @returns {Object} Model configuration
 */
export function getModelConfiguration(provider, modelId) {
    const defaultConfig = {
        inputTokenLimit: 15000,
        outputTokenLimit: 4000,
        temperature: 0.7,
        topP: undefined,
        frequencyPenalty: 0,
        presencePenalty: 0
    };

    const modelConfigs = {
        'openai': {
            'gpt-5': {inputTokenLimit: 25000, temperature: 0.7},
            'gpt-5-mini': {inputTokenLimit: 20000, temperature: 0.7},
            'gpt-5-nano': {inputTokenLimit: 16000, temperature: 0.7},
            'gpt-4.1-nano': {inputTokenLimit: 16000, temperature: 0.7},
            'gpt-4': {inputTokenLimit: 25000, temperature: 0.7},
            'gpt-4-turbo': {inputTokenLimit: 27000, temperature: 0.7},
            'gpt-3.5-turbo': {inputTokenLimit: 16000, temperature: 0.7}
        },
        'anthropic': {
            'claude-opus-4-1': {inputTokenLimit: 25000, outputTokenLimit: 4000, temperature: 0.7},
            'claude-sonnet-4-0': {inputTokenLimit: 24000, outputTokenLimit: 4000, temperature: 0.7},
            'claude-3-7-sonnet-latest': {inputTokenLimit: 24000, outputTokenLimit: 4000, temperature: 0.7},
            'claude-3-5-sonnet-latest': {inputTokenLimit: 22000, outputTokenLimit: 4000, temperature: 0.7},
            'claude-3-5-haiku-latest': {inputTokenLimit: 20000, outputTokenLimit: 3000, temperature: 0.7},
            'claude-3-opus-latest': {inputTokenLimit: 25000, outputTokenLimit: 4000, temperature: 0.7},
        },
        'google': {
            'gemini-3-pro-preview': {inputTokenLimit: 15000, temperature: 0.7},
            'gemini-2.5-pro': {inputTokenLimit: 15000, temperature: 0.7},
            'gemini-flash-latest': {inputTokenLimit: 15000, temperature: 0.7},
            'gemini-2.5-flash': {inputTokenLimit: 15000, temperature: 0.7},
            'gemini-2.5-flash-lite': {inputTokenLimit: 15000, temperature: 0.7},
            'gemini-2.0-flash': {inputTokenLimit: 15000, temperature: 0.7},
            'gemini-2.0-flash-lite': {inputTokenLimit: 15000, temperature: 0.7}
        },
        'openrouter': {
            'claude-3-sonnet-20240229': {inputTokenLimit: 25000, outputTokenLimit: 3000, temperature: 0.7},
        }
    };

    return (modelConfigs[provider] && modelConfigs[provider][modelId])
        || (modelConfigs[provider] && modelConfigs[provider].default)
        || defaultConfig;
}

/**
 * Checks if the text should be summarized based on various criteria.
 * @param {string} formattedText - The text to check
 * @param {number} commentDepth - Number of comments
 * @param {string} aiProvider - The AI provider
 * @returns {{status: string}}
 */
export function shouldSummarizeText(formattedText, commentDepth, aiProvider) {
    // Ollama can handle all kinds of data
    if (aiProvider === 'ollama') {
        return {status: SummarizeCheckStatus.OK};
    }

    // Cloud providers need minimum length and depth
    const minSentenceLength = 8;
    const minCommentDepth = 3;
    const sentences = formattedText.split(/[.!?]+(?:\s+|$)/)
        .filter(sentence => sentence.trim().length > 0);

    if (sentences.length <= minSentenceLength) {
        return {status: SummarizeCheckStatus.TEXT_TOO_SHORT};
    }
    if (commentDepth <= minCommentDepth) {
        return {status: SummarizeCheckStatus.THREAD_TOO_SHALLOW};
    }

    return {status: SummarizeCheckStatus.OK};
}

/**
 * Creates error message content for summarization validation failures.
 * @param {Object} params - Error parameters
 * @returns {Object} Panel content object
 */
export function createSummarizationErrorContent(status, author, aiProvider) {
    const metadataTemplates = {
        [SummarizeCheckStatus.TEXT_TOO_SHORT]: buildFragment([
            'Thread too brief to use the selected cloud AI ',
            createStrong(aiProvider)
        ]),
        [SummarizeCheckStatus.THREAD_TOO_SHALLOW]: buildFragment([
            'Thread not deep enough to use the selected cloud AI ',
            createStrong(aiProvider)
        ]),
        [SummarizeCheckStatus.THREAD_TOO_DEEP]: buildFragment([
            'Thread too deep for the selected AI ',
            createStrong(aiProvider)
        ])
    };

    const createThreadTooDeepMessage = () => buildFragment([
        'This ',
        createHighlightedAuthor(author),
        ' thread is too long or deeply nested to be handled by Chrome Built-in AI. The underlying model Gemini Nano may struggle and hallucinate with large content and deep nested threads due to model size limitations. This model works best with individual comments or brief discussion threads.',
        document.createElement('br'),
        document.createElement('br'),
        'However, if you still want to summarize this thread, you can ',
        createInternalLink('options-page-link', 'configure another AI provider'),
        ' like local ',
        createExternalLink('https://ollama.com/', 'Ollama'),
        ' or cloud AI services like OpenAI or Claude.'
    ]);

    const createThreadTooShortMessage = () => buildFragment([
        'This ',
        createHighlightedAuthor(author),
        ' thread is concise enough to read directly. Summarizing short threads with a cloud AI service would be inefficient.',
        document.createElement('br'),
        document.createElement('br'),
        'However, if you still want to summarize this thread, you can ',
        createInternalLink('options-page-link', 'configure a local AI provider'),
        ' like ',
        createExternalLink('https://developer.chrome.com/docs/ai/built-in', 'Chrome Built-in AI'),
        ' or ',
        createExternalLink('https://ollama.com/', 'Ollama'),
        ' for more efficient processing of shorter threads.'
    ]);

    return {
        title: 'Summarization not recommended',
        metadata: metadataTemplates[status],
        text: status === SummarizeCheckStatus.THREAD_TOO_DEEP
            ? createThreadTooDeepMessage()
            : createThreadTooShortMessage()
    };
}

/**
 * Creates user-friendly error message from error object.
 * @param {Error|string} error - The error
 * @returns {string}
 */
export function formatSummaryError(error) {
    let errorMessage = `Error generating summary. `;

    const errorStr = typeof error === 'string' ? error : error?.message || '';

    if (errorStr.includes('API key')) {
        errorMessage += 'Please check your API key configuration.';
    } else if (errorStr.includes('429')) {
        errorMessage += 'Rate limit exceeded. Please try again later.';
    } else if (errorStr.includes('current quota')) {
        errorMessage += 'API quota exceeded. Please try again later.';
    } else if (errorStr) {
        errorMessage += errorStr;
    } else {
        errorMessage += 'An unexpected error occurred. Please try again.';
    }

    return errorMessage;
}

/**
 * Summarizes text using a cloud LLM provider (OpenAI, Anthropic, Google, OpenRouter).
 * @param {string} aiProvider - Provider name
 * @param {string} modelId - Model ID
 * @param {string} apiKey - API key
 * @param {string} text - Text to summarize
 * @param {Map} commentPathToIdMap - Comment path to ID mapping
 * @param {Function} onSuccess - Success callback (summary, duration, commentPathToIdMap)
 * @param {Function} onError - Error callback (error)
 * @param {string} postTitle - Title of the post
 */
export async function summarizeTextWithLLM(aiProvider, modelId, apiKey, text, commentPathToIdMap, onSuccess, onError, postTitle) {
    if (!text || !aiProvider || !modelId || !apiKey) {
        await Logger.error('Missing required parameters for AI summarization');
        onError(new Error('Missing AI configuration'));
        return;
    }

    Logger.debugSync(`Summarizing with ${aiProvider} / ${modelId}`);

    const modelConfig = getModelConfiguration(aiProvider, modelId);
    const tokenLimitText = splitInputTextAtTokenLimit(text, modelConfig.inputTokenLimit);

    const systemPrompt = await getSystemMessage();
    const userPrompt = await getUserMessage(postTitle, tokenLimitText);

    const parameters = {
        temperature: modelConfig.temperature ?? 0.7,
        topP: modelConfig.topP,
        frequencyPenalty: modelConfig.frequencyPenalty,
        presencePenalty: modelConfig.presencePenalty,
        maxOutputTokens: modelConfig.outputTokenLimit ?? undefined
    };

    const llmInput = {
        aiProvider,
        modelId,
        apiKey,
        systemPrompt,
        userPrompt,
        parameters,
    };

    sendBackgroundMessage('HN_SUMMARIZE', llmInput).then(data => {
        const summary = data?.summary;
        if (!summary) {
            throw new Error('Empty summary returned from background message HN_SUMMARIZE. data: ' + JSON.stringify(data));
        }
        onSuccess(summary, data.duration, commentPathToIdMap);
    }).catch(error => {
        Logger.errorSync('LLM summarization failed in summarizeTextWithLLM(). Error:', error.message);
        onError(error);
    });
}

/**
 * Summarizes text using Ollama.
 * @param {string} text - Text to summarize
 * @param {string} model - Model name
 * @param {string} ollamaUrl - Ollama server URL
 * @param {Map} commentPathToIdMap - Comment path to ID mapping
 * @param {Function} onSuccess - Success callback (summary, duration, commentPathToIdMap)
 * @param {Function} onError - Error callback (error)
 * @param {string} postTitle - Title of the post
 */
export async function summarizeUsingOllama(text, model, ollamaUrl, commentPathToIdMap, onSuccess, onError, postTitle) {
    if (!text || !model) {
        await Logger.error('Missing required parameters for Ollama summarization');
        onError(new Error('Missing Ollama configuration'));
        return;
    }

    const endpoint = `${ollamaUrl}/api/generate`;
    const systemMessage = await getSystemMessage();
    const userMessage = await getUserMessage(postTitle, text);

    const payload = {
        model: model,
        system: systemMessage,
        prompt: userMessage,
        stream: false
    };

    sendBackgroundMessage('FETCH_API_REQUEST', {
        url: endpoint,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        timeout: 180_000
    })
        .then(data => {
            const summary = data.response;
            if (!summary) {
                throw new Error('No summary generated from API response');
            }
            onSuccess(summary, data.duration, commentPathToIdMap);
        }).catch(error => {
        Logger.errorSync('Error in Ollama summarization:', error);
        onError(error);
    });
}

/**
 * Creates Ollama error message fragment.
 * @param {Error} error - The error
 * @returns {DocumentFragment|string}
 */
export function createOllamaErrorMessage(error) {
    let errorMarkdown;
    if (error.message?.includes('403')) {
        errorMarkdown = `Ollama blocked the request (likely a CORS or server configuration issue).

**To fix:**

1. Restart Ollama with CORS enabled:
   \`\`\`
   OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*" ollama serve
   \`\`\`

2. Verify the Ollama URL in the extension settings and ensure Ollama is running.

*If the problem continues, check Ollama logs or the extension settings for more details.*`;
    } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        errorMarkdown = 'Could not connect to Ollama. Please ensure Ollama is running.';
    } else {
        errorMarkdown = 'Error generating summary. ' + error.message;
    }

    return createSummaryFragment(errorMarkdown, new Map());
}

/**
 * Gets cached summary from HNCompanion server.
 * @param {string} postId - The post ID
 * @returns {Promise<{summary: string, created_at: string}|null>}
 */
export async function getCachedSummary(postId) {
    const url = `https://app.hncompanion.com/api/posts/${postId}`;
    try {
        const data = await sendBackgroundMessage(
            'FETCH_API_REQUEST',
            {
                url, is404Expected: true
            }
        );

        if (data.status === 404) {
            await Logger.debug(`Cache miss: Post ${postId} not found in HNCompanion server. This is expected.`);
            return null;
        }

        if (!data || !data.summary) {
            await Logger.debug(`Cache miss: Post ${postId} returned invalid data from HNCompanion server.`);
            return null;
        }

        await Logger.debug(`Cache hit: Found summary for post ${postId} in HNCompanion server.`);
        return data;
    } catch (error) {
        await Logger.debug(`Failed to retrieve cache for post ${postId}: ${error.message}`);
        return null;
    }
}

/**
 * Checks if server cache is enabled in settings.
 * @returns {Promise<boolean>}
 */
export async function serverCacheConfigEnabled() {
    const settings = await storage.getItem('sync:settings');
    return settings?.serverCacheEnabled;
}

