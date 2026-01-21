/**
 * Generic Text Utility Functions
 * Pure utility functions for text processing, reusable across the extension.
 */

/**
 * Strips anchor tags from text using regex.
 * @param {string} text - Text containing anchor tags
 * @returns {string} Text with anchor tags removed
 */
export function stripAnchors(text) {
    const anchorRegex = /<a\b[^>]*>.*?<\/a>/g;
    return text.replace(anchorRegex, '');
}

/**
 * Splits input text at an approximate token limit.
 * Uses a rough estimate of 0.25 tokens per character.
 * @param {string} text - Text to split
 * @param {number} tokenLimit - Maximum tokens allowed
 * @returns {string} Truncated text
 */
export function splitInputTextAtTokenLimit(text, tokenLimit) {
    // Approximate token count per character
    const TOKENS_PER_CHAR = 0.25;

    // If the text is short enough, return it as is
    if (text.length * TOKENS_PER_CHAR < tokenLimit) {
        return text;
    }

    // Split the text into lines
    const lines = text.split('\n');
    let outputText = '';
    let currentTokenCount = 0;

    // Iterate through each line and accumulate until the token limit is reached
    for (const line of lines) {
        const lineTokenCount = line.length * TOKENS_PER_CHAR;
        if (currentTokenCount + lineTokenCount >= tokenLimit) {
            break;
        }
        outputText += line + '\n';
        currentTokenCount += lineTokenCount;
    }

    return outputText;
}
