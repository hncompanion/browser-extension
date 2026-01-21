/**
 * HN-Specific DOM Utility Functions
 * DOM utilities specific to Hacker News UI elements.
 */

/**
 * Creates a span with highlighted author styling.
 * @param {string} author - Author name
 * @returns {HTMLElement}
 */
export function createHighlightedAuthor(author) {
    const span = document.createElement('span');
    span.className = 'highlight-author';
    span.textContent = author;
    return span;
}

/**
 * Creates an in-page navigation anchor for a comment reference in AI summaries.
 *
 * Unlike standard <a href="#id"> links, this creates a custom anchor that
 * highlights the target comment, smoothly scrolls to it, and saves navigation
 * history for undo functionality. Click handling is set up in showSummaryInPanel().
 *
 * Example: <a href="...#46667941">MPSimmons</a> → <a data-comment-id="46667941">MPSimmons</a>
 * @param {string} commentId - The HN comment ID
 * @returns {HTMLAnchorElement}
 */
export function createCommentAnchor(commentId) {
    const link = document.createElement('a');
    link.href = '#';
    link.dataset.commentLink = 'true';
    link.dataset.commentId = commentId;
    link.className = 'summary-comment-link';

    // Set link's text and title such that it shows author name if found, else 'comment #123456'
    const commentElement = document.getElementById(commentId);
    const authorElement = commentElement?.querySelector('.hnuser');
    const authorName = authorElement?.textContent;

    if (authorName) {
        link.textContent = authorName;
        link.title = `Jump to ${authorName}'s comment`;
    } else {
        link.textContent = `comment #${commentId}`;
        link.title = `Jump to comment #${commentId}`;
    }

    return link;
}

/**
 * Creates a loading message element with a spinner.
 * @param {Array} parts - Array of Nodes or strings for the message
 * @returns {HTMLElement}
 */
export function createLoadingMessage(parts) {
    const wrapper = document.createElement('div');
    parts.forEach(part => {
        if (part === null || part === undefined) {
            return;
        }
        if (part instanceof Node) {
            wrapper.appendChild(part);
        } else {
            wrapper.append(String(part));
        }
    });
    const spinner = document.createElement('span');
    spinner.className = 'loading-spinner';
    wrapper.appendChild(spinner);
    return wrapper;
}
