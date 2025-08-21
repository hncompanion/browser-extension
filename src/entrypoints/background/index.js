import {summarizeText} from '../../lib/llm-summarizer.js';
import { storage } from '#imports';
import {browser} from "wxt/browser";
import {Logger} from "../../lib/utils.js";

export default defineBackground(() => {

    // Function to set default settings
    async function setDefaultSettings() {
        // Set Hacker News Companion Server as default provider
        await storage.setItem('sync:settings',{
                serverCacheEnabled: true,
                providerSelection: 'google',
                ollama: {
                    model: ''
                },
                google: {
                    apiKey: '',
                    model: ''
                },
                anthropic: {
                    apiKey: '',
                    model: ''
                },
                openai: {
                    apiKey: '',
                    model: ''
                },
                openrouter: {
                    apiKey: '',
                    model: ''
                }
            }
        );
        await Logger.debug('Default provider set to HN Companion Server');
    }

    browser.runtime.onInstalled.addListener(onInstalled);

    browser.action.onClicked.addListener(() => {
        // Opens your options page as defined in the manifest
        browser.runtime.openOptionsPage();
    });

    async function onInstalled() {
        await Logger.disableLogging();
        await Logger.info('Installed');
        await setDefaultSettings();

        try {
            // Check if we've already shown the options page before
            const hasShownOptionsPage = storage.getItem('local:hasShownOptionsPage');

            // Only open options page if we haven't shown it before
            if (!hasShownOptionsPage) {
                // Set flag that we've shown the options page
                await storage.setItem('local:hasShownOptionsPage', true);
                await browser.runtime.openOptionsPage();
            }
        } catch (e) {
            await Logger.error('Error during options page handling:', e);
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

    // Handle async message and send response
    function handleAsyncMessage(message, asyncOperation, sendResponse) {
        (async () => {
            try {
                const response = await asyncOperation();
                sendResponse({success: true, data: response});
            } catch (error) {
                await Logger.error(`Background script handler for ${message.type} message failed. Error: ${error}`);
                sendResponse({success: false, error: error.toString()});
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