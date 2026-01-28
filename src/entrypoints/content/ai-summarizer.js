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
 * Error type definitions for better error handling.
 * @typedef {'config' | 'api_key' | 'rate_limit' | 'quota' | 'network' | 'generic'} ErrorType
 */

/**
 * Creates SVG icon for error display.
 * @param {ErrorType} type - The error type
 * @returns {SVGElement}
 */
function createErrorIcon(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    let pathD;
    if (type === 'config' || type === 'api_key') {
        // Settings/gear icon
        pathD = 'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.204-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z';
    } else if (type === 'rate_limit' || type === 'quota') {
        // Clock icon
        pathD = 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z';
    } else if (type === 'network') {
        // Wifi off icon
        pathD = 'M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z';
    } else {
        // Alert triangle icon
        pathD = 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z';
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    svg.appendChild(path);

    return svg;
}

/**
 * Creates a styled error message element for the summary panel.
 * @param {Object} options - Error display options
 * @param {ErrorType} options.type - The error type
 * @param {string} options.title - The error title
 * @param {string} options.description - The error description
 * @param {Object} [options.action] - Optional action button
 * @param {string} options.action.label - Button label
 * @param {string} options.action.id - Button ID for event binding
 * @param {string} [options.hint] - Optional hint text
 * @returns {DocumentFragment}
 */
export function createErrorElement({ type, title, description, action, hint }) {
    const container = document.createElement('div');
    container.className = 'summary-error-container';

    // Icon
    const iconContainer = document.createElement('div');
    iconContainer.className = 'summary-error-icon';
    iconContainer.appendChild(createErrorIcon(type));
    container.appendChild(iconContainer);

    // Title
    const titleEl = document.createElement('div');
    titleEl.className = 'summary-error-title';
    titleEl.textContent = title;
    container.appendChild(titleEl);

    // Description
    const descEl = document.createElement('div');
    descEl.className = 'summary-error-description';
    descEl.textContent = description;
    container.appendChild(descEl);

    // Action button
    if (action) {
        const actionBtn = document.createElement('a');
        actionBtn.href = '#';
        actionBtn.className = 'summary-error-action';
        actionBtn.id = action.id;

        // Settings icon for button
        const btnIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        btnIcon.setAttribute('viewBox', '0 0 24 24');
        btnIcon.setAttribute('fill', 'none');
        btnIcon.setAttribute('stroke', 'currentColor');
        btnIcon.setAttribute('stroke-width', '2');
        const btnPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        btnPath.setAttribute('d', 'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.204-.107-.397.165-.71.505-.78.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z');
        btnIcon.appendChild(btnPath);

        actionBtn.appendChild(btnIcon);
        actionBtn.appendChild(document.createTextNode(action.label));
        container.appendChild(actionBtn);
    }

    // Hint
    if (hint) {
        const hintEl = document.createElement('div');
        hintEl.className = 'summary-error-hint';
        hintEl.innerHTML = hint;
        container.appendChild(hintEl);
    }

    const fragment = document.createDocumentFragment();
    fragment.appendChild(container);
    return fragment;
}

/**
 * Creates error element for missing AI configuration.
 * @returns {DocumentFragment}
 */
export function createConfigurationError() {
    return createErrorElement({
        type: 'config',
        title: 'AI Provider Not Configured',
        description: 'To generate summaries, you need to select an AI provider and add your API key in the settings.',
        action: { label: 'Open Settings', id: 'error-open-settings' },
        hint: 'You can use cloud AI services or run models locally.'
    });
}

/**
 * Creates user-friendly error element from error object.
 * @param {Error|string} error - The error
 * @returns {DocumentFragment}
 */
export function formatSummaryError(error) {
    const errorStr = typeof error === 'string' ? error : error?.message || '';

    // Missing AI configuration
    if (errorStr.includes('Missing AI configuration') || errorStr.includes('AI provider not configured')) {
        return createConfigurationError();
    }

    // API key issues
    if (errorStr.includes('API key') || errorStr.includes('401') || errorStr.includes('Unauthorized')) {
        return createErrorElement({
            type: 'api_key',
            title: 'Invalid API Key',
            description: 'Your API key appears to be invalid or expired. Please check your API key in the settings.',
            action: { label: 'Open Settings', id: 'error-open-settings' },
            hint: 'Make sure the API key is entered correctly without extra spaces.'
        });
    }

    // Rate limiting
    if (errorStr.includes('429') || errorStr.toLowerCase().includes('rate limit')) {
        return createErrorElement({
            type: 'rate_limit',
            title: 'Rate Limit Exceeded',
            description: 'You\'ve made too many requests. Please wait a moment before trying again.',
            hint: 'This usually resolves itself within a few minutes.'
        });
    }

    // Quota exceeded
    if (errorStr.includes('current quota') || errorStr.includes('quota exceeded') || errorStr.includes('insufficient_quota')) {
        return createErrorElement({
            type: 'quota',
            title: 'API Quota Exceeded',
            description: 'Your API usage quota has been exceeded. Please check your billing settings with your AI provider.',
            hint: 'You may need to add credits or upgrade your plan.'
        });
    }

    // Network errors
    if (errorStr.includes('Failed to fetch') || errorStr.includes('NetworkError') || errorStr.includes('network')) {
        return createErrorElement({
            type: 'network',
            title: 'Connection Failed',
            description: 'Could not connect to the AI service. Please check your internet connection and try again.',
            hint: 'If using Ollama, make sure it\'s running locally.'
        });
    }

    // Generic error with the actual message
    return createErrorElement({
        type: 'generic',
        title: 'Summary Generation Failed',
        description: errorStr || 'An unexpected error occurred while generating the summary.',
        hint: 'Try again or check the browser console for more details.'
    });
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
    // For 403 errors, show detailed CORS instructions using markdown
    if (error.message?.includes('403')) {
        const errorMarkdown = `Ollama blocked the request (likely a CORS or server configuration issue).

**To fix:**

1. Restart Ollama with CORS enabled:
   \`\`\`
   OLLAMA_ORIGINS="chrome-extension://*,moz-extension://*" ollama serve
   \`\`\`

2. Verify the Ollama URL in the extension settings and ensure Ollama is running.

*If the problem continues, check Ollama logs or the extension settings for more details.*`;
        return createSummaryFragment(errorMarkdown, new Map());
    }

    // For network errors, use the styled error element
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        return createErrorElement({
            type: 'network',
            title: 'Cannot Connect to Ollama',
            description: 'Could not connect to the Ollama server. Please make sure Ollama is running locally.',
            action: { label: 'Open Settings', id: 'error-open-settings' },
            hint: 'Run "ollama serve" in your terminal to start Ollama.'
        });
    }

    // For other errors, use the styled error element with the message
    return createErrorElement({
        type: 'generic',
        title: 'Ollama Error',
        description: error.message || 'An unexpected error occurred while communicating with Ollama.',
        action: { label: 'Open Settings', id: 'error-open-settings' },
        hint: 'Check your Ollama configuration and try again.'
    });
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

