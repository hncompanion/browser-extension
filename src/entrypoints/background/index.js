import {summarizeText} from '../../lib/llm-summarizer.js';

export default defineBackground(() => {

    // Function to set default settings
    async function setDefaultSettings() {
        // Check if settings already exist
        const existingSettings = await browser.storage.sync.get('settings');

        // Only set defaults if no provider is already chosen
        if (!existingSettings) {
            // Set Hacker News Companion Server as default provider
            await browser.storage.sync.set({
                settings: {
                    providerSelection: 'hn-companion-server',
                    ollama: {
                        model: ''
                    },
                    google_gemini: {
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
            });

            console.log('Default provider set to HN Companion Server');
        }
    }

    browser.runtime.onInstalled.addListener(onInstalled);

    browser.action.onClicked.addListener(() => {
        // Opens your options page as defined in the manifest
        browser.runtime.openOptionsPage();
    });

    async function onInstalled() {
        await setDefaultSettings();
        try {
            browser.runtime.openOptionsPage();
        } catch (e) {
            console.log('Error opening options page:', e);
        }
    }

        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {

            console.log('Background script received message of type:', message.type);

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
                    console.log('Unknown message type:', message.type);
            }
        });

// Handle async message and send response
function handleAsyncMessage(message, asyncOperation, sendResponse) {
    (async () => {
        try {
            const response = await asyncOperation();
            sendResponse({success: true, data: response});
        } catch (error) {
            console.error(`Message: ${message.type}. Error: ${error}`);
            sendResponse({success: false, error: error.toString()});
        }
    })();

    // indicate that sendResponse will be called later and hence keep the message channel open
    return true;
}

// Utility function for API calls with timeout
async function fetchWithTimeout(url, options = {}) {

    const {method = 'GET', headers = {}, body = null,
           timeout = 60_000, is404Expected = false} = options;

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

            // Handle 404 responses specially if they're expected, for eg. when checking cached summary of a post
            if (response.status === 404 && is404Expected) {
                // This is an expected 404, not an error. So return as data instead of throwing an error
                return {
                    status: 404,
                    message: responseText || 'Not found'
                };
            }

            const errorText = `API Error: HTTP error code: ${response.status}, URL: ${url} \nBody: ${responseText}`;
            console.error(errorText);
            return Promise.reject(new Error(errorText));
        }

        return await response.json();

    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms: ${url}`);
        }
        throw error;
    }
}
});

