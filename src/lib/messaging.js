import { browser } from '#imports';
import { Logger } from './utils.js';

/**
 * Send a message to the background script and handle the response.
 * @param {string} type - Message type
 * @param {object} data - Message data
 * @returns {Promise<object>} - Response data with duration property
 */
export async function sendBackgroundMessage(type, data) {
    Logger.debugSync(`Sending browser runtime message ${type}:`, data);

    const startTime = performance.now();
    let response;
    let duration = 0;

    try {
        response = await browser.runtime.sendMessage({ type, data });
        duration = Math.round((performance.now() - startTime) / 1000);
        Logger.debugSync(`Got response from background message '${type}' in ${duration}s. URL: ${data?.url || 'N/A'}`);
    } catch (error) {
        duration = Math.round((performance.now() - startTime) / 1000);
        const errorMessage = `Error sending background message '${type}' URL: ${data?.url || 'N/A'}. Duration: ${duration}s. Error: ${error.message}`;
        await Logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    if (!response) {
        await Logger.error(`No response from background message ${type}`);
        throw new Error(`No response from background message ${type}`);
    }
    if (!response.success) {
        // Only log error if not an expected failure
        if (!response.isErrorExpected) {
            await Logger.error(`Error response from background message ${type}:`, response.error);
        }
        throw new Error(response.error);
    }

    const responseData = response.data ?? {};
    responseData.duration = duration;
    return responseData;
}

export function sendStreamingMessage(type, data, onChunk) {
    return new Promise((resolve, reject) => {
        const startTime = performance.now();
        const port = browser.runtime.connect({ name: 'HN_STREAM' });
        let settled = false;

        port.onMessage.addListener((message) => {
            switch (message.type) {
                case 'chunk':
                    onChunk(message.delta);
                    break;
                case 'done': {
                    const duration = Math.round((performance.now() - startTime) / 1000);
                    settled = true;
                    port.disconnect();
                    resolve({ summary: message.text, duration });
                    break;
                }
                case 'error': {
                    settled = true;
                    port.disconnect();
                    reject(new Error(message.error));
                    break;
                }
            }
        });

        // The background end can go away without sending 'done' or 'error'
        // (e.g. the service worker is stopped mid-stream). Always settle, or
        // the caller waits forever with the loading state on screen.
        port.onDisconnect.addListener(() => {
            if (settled) return;
            settled = true;
            const error = browser.runtime.lastError;
            reject(new Error(error?.message
                || 'Connection to the extension background was lost before the summary finished. Please try again.'));
        });

        port.postMessage({ type, data });
    });
}
