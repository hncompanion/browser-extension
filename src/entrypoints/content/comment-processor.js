/**
 * Comment Processor Module
 * DOM/API comment parsing and enrichment functionality.
 */

import {Logger} from "../../lib/utils.js";
import {sendBackgroundMessage} from "../../lib/messaging.js";
import {sanitizeHtmlToFragment, enforceSafeLinks} from '../../lib/sanitize.js';
import {createCommentAnchor} from './hn-dom-utils.js';
import {marked} from 'marked';

// Configure marked options
marked.setOptions({
    headerIds: false,
    mangle: false
});

/**
 * Fetches comments from HN Algolia API.
 * @param {string} itemId - The HN item ID
 * @returns {Promise<Object>} The comment tree
 */
export async function fetchHNCommentsFromAPI(itemId) {
    return await sendBackgroundMessage(
        'FETCH_API_REQUEST',
        {
            url: `https://hn.algolia.com/api/v1/items/${itemId}`,
            method: 'GET'
        }
    );
}

/**
 * Gets the HN thread data including formatted comments and path-to-ID mapping.
 * @param {string} itemId - The HN item ID
 * @returns {Promise<{formattedComment: string, commentPathToIdMap: Map}|null>}
 */
export async function getHNThread(itemId) {
    try {
        const commentsJson = await fetchHNCommentsFromAPI(itemId);
        const commentsInDOM = getCommentsFromDOM();

        const enhancedComments = enrichPostComments(commentsJson, commentsInDOM);

        // Create the path-to-id mapping
        const commentPathToIdMap = new Map();
        enhancedComments.forEach((comment, id) => {
            commentPathToIdMap.set(comment.path, id);
        });

        // Convert structured comments to formatted text
        const formattedComment = [...enhancedComments.values()]
            .map(comment => {
                return [
                    `[${comment.path}]`,
                    `(score: ${comment.score})`,
                    `<replies: ${comment.replies}>`,
                    `{downvotes: ${comment.downvotes}}`,
                    `${comment.author}:`,
                    comment.text
                ].join(' ') + '\n';
            })
            .join('');

        Logger.debugSync('formattedComment...', formattedComment);

        return {
            formattedComment,
            commentPathToIdMap
        };
    } catch (error) {
        await Logger.error(`Error in getHNThread: ${error.message}`);
        return null;
    }
}

/**
 * Gets comments from the DOM with position, downvotes, and text.
 * @returns {Map<number, {position: number, text: string, downvotes: number}>}
 */
export function getCommentsFromDOM() {
    const commentsInDOM = new Map();

    const commentRows = document.querySelectorAll('.comtr');
    Logger.debugSync(`Found ${commentRows.length} DOM comments in post`);

    let skippedComments = 0;
    commentRows.forEach((commentRow, index) => {
        // Skip flagged or invisible comments
        const commentFlagged = commentRow.classList.contains('coll') || commentRow.classList.contains('noshow');
        const commentTextDiv = commentRow.querySelector('.commtext');
        if (commentFlagged || !commentTextDiv) {
            skippedComments++;
            return;
        }

        // Sanitize the comment text
        function sanitizeCommentText() {
            const tempDiv = commentTextDiv.cloneNode(true);

            [...tempDiv.querySelectorAll('a, code, pre')].forEach(element => element.remove());

            tempDiv.querySelectorAll('p').forEach(p => {
                const text = p.textContent;
                p.replaceWith(text);
            });

            return (tempDiv.textContent || '').replace(/\n+/g, ' ');
        }
        const commentText = sanitizeCommentText();

        // Get downvote count from text color
        function getDownvoteCount(commentTextDiv) {
            const downvotePattern = /c[0-9a-f]{2}/;
            const downvoteClass = [...commentTextDiv.classList.values()]
                .find(className => downvotePattern.test(className.toLowerCase()))
                ?.toLowerCase();

            if (!downvoteClass) {
                return 0;
            }

            const downvoteMap = {
                'c00': 0,
                'c5a': 1,
                'c73': 2,
                'c82': 3,
                'c88': 4,
                'c9c': 5,
                'cae': 6,
                'cbe': 7,
                'cce': 8,
                'cdd': 9
            };
            return downvoteMap[downvoteClass] || 0;
        }
        const downvotes = getDownvoteCount(commentTextDiv);

        const commentId = commentRow.getAttribute('id');

        commentsInDOM.set(Number(commentId), {
            position: index,
            text: commentText,
            downvotes: downvotes,
        });
    });

    Logger.debugSync(`...Comments from DOM:: Total: ${commentRows.length}. Skipped (flagged): ${skippedComments}. Remaining: ${commentsInDOM.size}`);

    return commentsInDOM;
}

/**
 * Enriches post comments by merging API tree structure with DOM position/metadata.
 * @param {Object} commentsTree - Comment tree from API
 * @param {Map} commentsInDOM - Comments from DOM
 * @returns {Map} Enhanced comments with path, score, etc.
 */
export function enrichPostComments(commentsTree, commentsInDOM) {
    let flatComments = new Map();

    let apiComments = 0;
    let skippedComments = 0;

    function flattenCommentTree(comment, parentId) {
        apiComments++;

        // If this is the story item (root), flatten its children
        if (comment.type === 'story') {
            if (comment.children && comment.children.length > 0) {
                comment.children.forEach(child => {
                    flattenCommentTree(child, null);
                });
            }
            return;
        }

        const commentInDOM = commentsInDOM.get(comment.id);
        if (!commentInDOM) {
            skippedComments++;
            return;
        }

        flatComments.set(comment.id, {
            id: comment.id,
            author: comment.author,
            replies: comment.children?.length || 0,
            position: commentInDOM.position,
            text: commentInDOM.text,
            downvotes: commentInDOM.downvotes,
            parentId: parentId,
        });

        if (comment.children && comment.children.length > 0) {
            comment.children.forEach(child => {
                flattenCommentTree(child, comment.id);
            });
        }
    }

    flattenCommentTree(commentsTree, null);

    Logger.debugSync(`...Comments from API:: Total: ${apiComments - 1}. Skipped: ${skippedComments}. Remaining: ${flatComments.size}`);

    // Sort by position
    const enrichedComments = new Map([...flatComments.entries()]
        .sort((a, b) => a[1].position - b[1].position));

    // Calculate paths
    let topLevelCounter = 1;

    function calculatePath(comment) {
        let path;

        if (!comment.parentId) {
            path = String(topLevelCounter++);
        } else {
            const parent = enrichedComments.get(comment.parentId);

            if (!parent || !parent.path) {
                path = String(topLevelCounter++);
            } else {
                const parentPath = parent.path;

                const siblings = [...enrichedComments.values()]
                    .filter(c => c.parentId === comment.parentId);

                const positionInParent = siblings
                    .findIndex(c => c.id === comment.id) + 1;

                path = `${parentPath}.${positionInParent}`;
            }
        }
        return path;
    }

    function calculateScore(comment, totalCommentCount) {
        const downvotes = comment.downvotes || 0;
        const MAX_SCORE = 1000;
        const MAX_DOWNVOTES = 10;

        const defaultScore = Math.floor(MAX_SCORE - (comment.position * MAX_SCORE / totalCommentCount));
        const penaltyPerDownvote = defaultScore / MAX_DOWNVOTES;
        const penalty = penaltyPerDownvote * downvotes;

        return Math.floor(Math.max(defaultScore - penalty, 0));
    }

    enrichedComments.forEach(comment => {
        comment.path = calculatePath(comment);
        comment.score = calculateScore(comment, enrichedComments.size);
    });

    return enrichedComments;
}

/**
 * Converts markdown summary text into a safe, interactive DOM fragment.
 * @param {string} markdown - The markdown text
 * @param {Map} commentPathToIdMap - Map of path strings to comment IDs
 * @returns {DocumentFragment}
 */
export function createSummaryFragment(markdown, commentPathToIdMap) {
    // Preprocess cached markdown links
    const cachedLinkRegex = /\[comment #\d+\]\((https?:\/\/news\.ycombinator\.com\/item\?id=\d+#\d+)\)\s*\(([^)]+)\)/g;

    const normalizedMarkdown = markdown
        ? markdown.replace(cachedLinkRegex, (_, url, author) => `[${author}](${url})`)
        : '';

    let html;
    try {
        html = marked.parse(normalizedMarkdown || '');
    } catch (e) {
        Logger.error('Failed to parse markdown, displaying raw text:', e);
        const fragment = document.createDocumentFragment();
        const pre = document.createElement('pre');
        pre.textContent = normalizedMarkdown || '';
        fragment.appendChild(pre);
        return fragment;
    }
    const fragment = sanitizeHtmlToFragment(html);
    replaceCommentBacklinks(fragment, commentPathToIdMap);
    enforceSafeLinks(fragment);
    return fragment;
}

/**
 * Replaces comment references with interactive navigation anchors.
 * @param {DocumentFragment} fragment - The fragment to process
 * @param {Map} commentPathToIdMap - Map of path strings to comment IDs
 */
export function replaceCommentBacklinks(fragment, commentPathToIdMap) {
    if (!fragment) return;

    // Handle server-cached summaries with resolved URLs
    fragment.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        const match = href.match(/^https?:\/\/news\.ycombinator\.com\/item\?id=\d+#(\d+)/);
        if (!match) return;
        const commentId = match[1];
        link.replaceWith(createCommentAnchor(commentId));
    });

    const textNodes = [];
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    // Handle user-generated summaries with path notation
    const pathRegex = /\[(\d+(?:\.\d+)*)]\s*(?:\([^)]+\))?/g;
    textNodes.forEach(node => {
        const text = node.nodeValue;
        if (!text || !text.includes('[')) return;

        const replacement = document.createDocumentFragment();
        let lastIndex = 0;
        let match;
        let hasMatches = false;

        while ((match = pathRegex.exec(text)) !== null) {
            hasMatches = true;
            if (match.index > lastIndex) {
                replacement.append(text.slice(lastIndex, match.index));
            }
            const path = match[1];
            const commentId = commentPathToIdMap?.get(path);
            if (commentId) {
                replacement.appendChild(createCommentAnchor(commentId));
            } else {
                replacement.append(match[0]);
            }
            lastIndex = match.index + match[0].length;
        }
        pathRegex.lastIndex = 0;

        if (!hasMatches) return;

        if (lastIndex < text.length) {
            replacement.append(text.slice(lastIndex));
        }
        node.replaceWith(replacement);
    });
}
