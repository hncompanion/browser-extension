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
