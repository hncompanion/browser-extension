import {summarizeText, streamSummarizeText} from '../../lib/llm-summarizer.js';
import { storage } from '#imports';
import {browser} from "wxt/browser";
import {Logger} from "../../lib/utils.js";

export default defineBackground(() => {

    const DEFAULT_SETTINGS = {
        serverCacheEnabled: true,
        generationEnabled: true,
        providerSelection: 'google',
        ollama: {
            cloud: false,
            apiKey: '',
            model: ''
        },
        google: {
            apiKey: '',
            model: 'gemini-3.5-flash'
        },
        anthropic: {
            apiKey: '',
            model: 'claude-opus-4-8'
        },
        openai: {
            apiKey: '',
            model: 'gpt-5.5'
        },
        'openai-compatible': {
            preset: 'openrouter',
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: '',
            model: ''
        }
    };

    // Function to set default settings
    async function setDefaultSettings() {
        // Set Hacker News Companion Server as default provider
        await storage.setItem('sync:settings', DEFAULT_SETTINGS);
        await Logger.debug('Default settings initialized');
    }

    browser.runtime.onInstalled.addListener(onInstalled);

    browser.action.onClicked.addListener(() => {
        // Opens your options page as defined in the manifest
        browser.runtime.openOptionsPage();
    });

    async function onInstalled(details) {
        await Logger.disableLogging();
        await Logger.info(`Installed: ${details.reason}`);
        
        const existingSettings = await storage.getItem('sync:settings');
        if (!existingSettings) {
            await setDefaultSettings();
        }

        if (details.reason === 'install') {
            try {
                // Check if we've already shown the welcome page before (redundant but safe)
                const hasShownWelcomePage = await storage.getItem('local:hasShownWelcomePage');

                // Only open welcome page if we haven't shown it before
                if (!hasShownWelcomePage) {
                    // Set flag that we've shown the welcome page
                    await storage.setItem('local:hasShownWelcomePage', true);
                    await browser.tabs.create({
                        url: browser.runtime.getURL('/welcome.html')
                    });
                }
            } catch (e) {
                await Logger.error('Error during welcome page handling:', e);
            }
        }
    }

    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

        Logger.infoSync('Background script received message of type:', message.type);

        // Handle the message
        switch (message.type) {
            case 'HN_SHOW_OPTIONS':
                browser.runtime.openOptionsPage();
                break;

            case 'FETCH_API_REQUEST':
                return handleAsyncMessage(
                    message,
                    async () => await fetchWithTimeout(message.data.url, message.data),
                    sendResponse
                );

            case 'HN_SUMMARIZE':
                return handleAsyncMessage(
                    message,
                    async () => {
                        const summary = await summarizeText(message.data);
                        return { summary: summary };
                    },
                    sendResponse
                );

            default:
                Logger.infoSync('Unknown message type:', message.type);
        }
    });

    // Handle streaming connections via ports
    browser.runtime.onConnect.addListener((port) => {
        if (port.name !== 'HN_STREAM') return;

        let abortController = null;

        port.onDisconnect.addListener(() => {
            if (abortController) abortController.abort();
        });

        port.onMessage.addListener(async (message) => {
            const safeSend = (msg) => {
                try { port.postMessage(msg); } catch (_) { /* port disconnected */ }
            };

            if (message.type === 'HN_STREAM_SUMMARIZE') {
                abortController = new AbortController();
                await streamSummarizeText(
                    message.data,
                    (delta) => safeSend({ type: 'chunk', delta }),
                    (fullText) => safeSend({ type: 'done', text: fullText }),
                    (error) => safeSend({ type: 'error', error: error.toString() }),
                    abortController.signal
                );
            } else if (message.type === 'HN_STREAM_OLLAMA') {
                abortController = new AbortController();
                let timedOut = false;
                let timeoutId = null;
                const timeoutMs = message.data.timeout || 180_000;
                try {
                    const { url, method, headers, body } = message.data;
                    timeoutId = setTimeout(() => {
                        timedOut = true;
                        abortController.abort();
                    }, timeoutMs);
                    const response = await fetch(url, {
                        method, headers, body,
                        signal: abortController.signal
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        safeSend({ type: 'error', error: `API Error: HTTP ${response.status} ${errorText}` });
                        return;
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let fullText = '';
                    let buffer = '';

                    // Process one complete NDJSON line. Returns true when the
                    // stream signalled done so the caller can stop early.
                    const handleLine = (line) => {
                        if (!line.trim()) return false;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.response) {
                                fullText += parsed.response;
                                safeSend({ type: 'chunk', delta: parsed.response });
                            }
                            if (parsed.done) {
                                safeSend({ type: 'done', text: fullText });
                                return true;
                            }
                        } catch (_) { /* skip malformed lines */ }
                        return false;
                    };

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (abortController.signal.aborted) break;

                        // Buffer across reads: a JSON object may be split over
                        // two chunks, so only the trailing partial line is held
                        // back until its newline arrives.
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() ?? '';
                        for (const line of lines) {
                            if (handleLine(line)) return;
                        }
                    }

                    if (abortController.signal.aborted) {
                        if (timedOut) {
                            safeSend({ type: 'error', error: `Request timed out after ${Math.round(timeoutMs / 1000)}s` });
                        }
                        return;
                    }

                    // Flush any final line left without a trailing newline.
                    buffer += decoder.decode();
                    if (handleLine(buffer)) return;

                    safeSend({ type: 'done', text: fullText });
                } catch (error) {
                    if (timedOut) {
                        safeSend({ type: 'error', error: `Request timed out after ${Math.round(timeoutMs / 1000)}s` });
                    } else if (!abortController.signal.aborted) {
                        safeSend({ type: 'error', error: error.toString() });
                    }
                } finally {
                    if (timeoutId) clearTimeout(timeoutId);
                }
            }
        });
    });

    // Handle async message and send response
    function handleAsyncMessage(message, asyncOperation, sendResponse) {
        (async () => {
            try {
                const response = await asyncOperation();
                sendResponse({success: true, data: response});
            } catch (error) {
                // Only log error if not an expected failure (e.g., Ollama not running)
                if (!message.data?.isErrorExpected) {
                    await Logger.error(`Background script handler for ${message.type} message failed. Error: ${error}`);
                }
                sendResponse({success: false, error: error.toString(), isErrorExpected: message.data?.isErrorExpected});
            }
        })();

        // indicate that sendResponse will be called later and hence keep the message channel open
        return true;
    }

    // Utility function for API calls with timeout
    async function fetchWithTimeout(url, options = {}) {

        const {
            method = 'GET', headers = {}, body = null,
            timeout = 60_000, is404Expected = false
        } = options;

        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method,
                headers,
                body,
                signal: controller.signal
            });
            clearTimeout(id);

            if (!response.ok) {
                const responseText = await response.text();

                // Handle 404 responses specially if they're expected, for e.g. when checking cached summary of a post
                if (response.status === 404 && is404Expected) {
                    // This is an expected 404, not an error. So return as data instead of throwing an error
                    return {
                        status: 404,
                        message: responseText || 'Not found'
                    };
                }

                const errorText = `API Error: HTTP error code: ${response.status}, URL: ${url} \nBody: ${responseText}`;
                await Logger.error(errorText);
                throw new Error(errorText);
            }

            return await response.json();

        } catch (error) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms: ${url}`);
            }
            const errorPrefix = `fetch API failed in fetchWithTimeout(). URL: ${url}, method: ${method}`;
            if (error instanceof Error) {
                error.message = `${errorPrefix} Error: ${error.message}`;
                throw error;
            }
            throw new Error(`${errorPrefix}. Error: ${String(error)}`);
        }
    }
});
