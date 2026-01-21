/**
 * Generic DOM Utility Functions
 * Pure utility functions for DOM manipulation, reusable across the extension.
 */

/**
 * Creates a DocumentFragment from an array of nodes and text parts.
 * @param {Array} parts - Array of Nodes or strings to combine
 * @returns {DocumentFragment}
 */
export function buildFragment(parts) {
    const fragment = document.createDocumentFragment();
    parts.forEach(part => {
        if (part === null || part === undefined) {
            return;
        }
        if (part instanceof Node) {
            fragment.appendChild(part);
        } else {
            fragment.append(String(part));
        }
    });
    return fragment;
}

/**
 * Creates a <strong> element with the given text.
 * @param {string} text - Text content
 * @returns {HTMLElement}
 */
export function createStrong(text) {
    const strong = document.createElement('strong');
    strong.textContent = text;
    return strong;
}

/**
 * Creates an external link that opens in a new tab.
 * @param {string} url - The URL to link to
 * @param {string} label - The link text
 * @returns {HTMLAnchorElement}
 */
export function createExternalLink(url, label) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    return link;
}

/**
 * Creates an internal link with an ID for event binding.
 * @param {string} id - Element ID
 * @param {string} label - The link text
 * @returns {HTMLAnchorElement}
 */
export function createInternalLink(id, label) {
    const link = document.createElement('a');
    link.href = '#';
    link.id = id;
    link.textContent = label;
    return link;
}

/**
 * Decodes HTML entities using the browser's built-in parsing.
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
export function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}
