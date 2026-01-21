/**
 * Keyboard Shortcuts Module
 * Keyboard event handling and shortcut definitions.
 */

import {Logger} from "../../lib/utils.js";

/**
 * Creates home page keyboard shortcut handlers.
 * @param {Object} handlers - Object with handler functions
 * @returns {Object} Shortcut key to handler mapping
 */
export function getHomePageKeyboardShortcuts(handlers) {
    return {
        'j': () => handlers.navigateToPost('next'),
        'k': () => handlers.navigateToPost('prev'),
        'o': () => {
            const currentPost = handlers.getCurrentPost();
            if (!currentPost) return;

            const postLink = currentPost.querySelector('.titleline a');
            if (postLink) {
                window.open(postLink.href, '_blank');
            }
        },
        'Shift+C': () => {
            const currentPost = handlers.getCurrentPost();
            if (!currentPost) return;

            if (currentPost.nextElementSibling) {
                const subtext = currentPost.nextElementSibling;
                const commentsLink = subtext.querySelector('a[href^="item?id="]');
                if (commentsLink) {
                    window.open(commentsLink.href, '_blank');
                }
            }
        },
        'c': () => {
            const currentPost = handlers.getCurrentPost();
            if (!currentPost) return;

            if (currentPost.nextElementSibling) {
                const subtext = currentPost.nextElementSibling;
                const commentsLink = subtext.querySelector('a[href^="item?id="]');
                if (commentsLink) {
                    window.location.href = commentsLink.href;
                }
            }
        }
    };
}

/**
 * Creates comments page keyboard shortcut handlers.
 * @param {Object} handlers - Object with handler functions
 * @returns {Object} Shortcut key to handler mapping
 */
export function getCommentsPageKeyboardShortcuts(handlers) {
    // Helper to get current comment dynamically
    const getCurrentComment = () => handlers.commentNavigator?.currentComment;

    return {
        'j': () => {
            const currentComment = getCurrentComment();
            const nextComment = handlers.getNavElementByName(currentComment, 'next');
            if (nextComment) {
                handlers.setCurrentComment(nextComment);
            }
        },
        'k': () => {
            const currentComment = getCurrentComment();
            const prevComment = handlers.getNavElementByName(currentComment, 'prev');
            if (prevComment) {
                handlers.setCurrentComment(prevComment);
            } else {
                handlers.navigateToChildComment(false);
            }
        },
        'l': () => handlers.navigateToChildComment(true),
        'h': () => handlers.navigateToChildComment(false),
        'r': () => {
            const currentComment = getCurrentComment();
            const rootComment = handlers.getNavElementByName(currentComment, 'root')
                || handlers.getNavElementByName(currentComment, 'parent');
            if (rootComment) {
                handlers.setCurrentComment(rootComment);
            }
        },
        '[': () => {
            const currentComment = getCurrentComment();
            const authorElement = currentComment?.querySelector('.hnuser');
            if (authorElement) {
                const author = authorElement.textContent;
                handlers.navigateAuthorComments(author, currentComment, 'prev');
            }
        },
        ']': () => {
            const currentComment = getCurrentComment();
            const authorElement = currentComment?.querySelector('.hnuser');
            if (authorElement) {
                const author = authorElement.textContent;
                handlers.navigateAuthorComments(author, currentComment, 'next');
            }
        },
        'z': () => {
            const currentComment = getCurrentComment();
            if (currentComment) {
                currentComment.scrollIntoView({behavior: 'smooth', block: 'center'});
            }
        },
        'c': () => {
            const currentComment = getCurrentComment();
            if (currentComment) {
                const toggleLink = currentComment.querySelector('.togg');
                if (toggleLink) {
                    toggleLink.click();
                }
            }
        },
        'o': () => {
            const postLink = document.querySelector('.titleline a');
            if (postLink) {
                window.open(postLink.href, '_blank');
            }
        },
        's': async () => {
            handlers.summaryPanel.toggle();

            // If the summary panel is visible, but content has not been populated (i.e., first time opening the panel), 
            //  trigger a single summarization so the shortcut feels immediate and avoids duplicate fetches.
            if (handlers.summaryPanel.isVisible && !handlers.summaryPanel.contentUpdated) {
                await handlers.summarizeAllComments();
            }
        },
        'u': () => handlers.undoNavigation()
    };
}

/**
 * Creates global keyboard shortcut handlers.
 * @param {Object} handlers - Object with handler functions
 * @returns {Object} Shortcut key to handler mapping
 */
export function getGlobalKeyboardShortcuts(handlers) {
    return {
        '?': () => handlers.toggleHelpModal(handlers.helpModal.style.display === 'none'),
        '/': () => handlers.toggleHelpModal(handlers.helpModal.style.display === 'none'),
        'Escape': () => {
            if (handlers.helpModal.style.display !== 'none') {
                handlers.toggleHelpModal(false);
            }
        }
    };
}

/**
 * Creates double-key combination handlers.
 * @param {Object} handlers - Object with handler functions
 * @param {Object} trackingState - State for tracking key presses
 * @returns {Object} Page-specific double-key combinations
 */
export function getDoubleKeyShortcuts(handlers, trackingState) {
    return {
        'comments': {
            'g+g': () => {
                const currentTime = Date.now();
                if (trackingState.lastKey === 'g' && currentTime - trackingState.lastKeyPressTime < 500) {
                    handlers.navigateToFirstComment();
                }
                trackingState.lastKey = 'g';
                trackingState.lastKeyPressTime = currentTime;
            }
        },
        'home': {
            'g+g': () => {
                const currentTime = Date.now();
                if (trackingState.lastKey === 'g' && currentTime - trackingState.lastKeyPressTime < 500) {
                    handlers.navigateToPost('first');
                }
                trackingState.lastKey = 'g';
                trackingState.lastKeyPressTime = currentTime;
            }
        }
    };
}

/**
 * Sets up all keyboard shortcuts.
 * @param {Object} config - Configuration object
 * @param {boolean} config.isHomePage - Whether on home page
 * @param {boolean} config.isCommentsPage - Whether on comments page
 * @param {Object} config.handlers - Handler functions
 */
export function setupKeyboardShortcuts(config) {
    const {isHomePage, isCommentsPage, handlers} = config;

    // Track last key press for combinations
    const trackingState = {
        lastKey: null,
        lastKeyPressTime: 0
    };
    const KEY_COMBO_TIMEOUT = 1000;

    const doubleKeyShortcuts = getDoubleKeyShortcuts(handlers, trackingState);
    const homePageKeyboardShortcuts = getHomePageKeyboardShortcuts(handlers);
    const commentsPageKeyboardShortcuts = getCommentsPageKeyboardShortcuts(handlers);
    const globalKeyboardShortcuts = getGlobalKeyboardShortcuts(handlers);

    document.addEventListener('keydown', (e) => {
        // Skip if in input field or using Ctrl/Cmd
        const isInputField = e.target.matches('input, textarea, select, [contenteditable="true"]');
        if (isInputField || e.ctrlKey || e.metaKey) {
            return;
        }

        Logger.debugSync(`Pressed key: ${e.key}. Shift key: ${e.shiftKey}`);

        const currentTime = Date.now();
        let shortcutKey = e.key;

        // Check for shifted keys
        const shiftedKeys = ['?'];
        const isShiftedKey = e.shiftKey && shiftedKeys.includes(e.key);

        // Check for Shift+letter combinations
        const isShiftedLetter = e.shiftKey && /^[A-Z]$/.test(e.key);

        if (isShiftedLetter) {
            shortcutKey = `Shift+${e.key}`;
        } else if (!isShiftedKey) {
            // Check for key combination
            if (trackingState.lastKey && (currentTime - trackingState.lastKeyPressTime) < KEY_COMBO_TIMEOUT) {
                shortcutKey = `${trackingState.lastKey}+${shortcutKey}`;
            }
        }

        // Build page-specific shortcuts
        const pageShortcuts = isHomePage ? {
            ...homePageKeyboardShortcuts,
            ...(doubleKeyShortcuts['home'] || {})
        } : isCommentsPage ? {
            ...commentsPageKeyboardShortcuts,
            ...(doubleKeyShortcuts['comments'] || {})
        } : {};

        const shortcutHandler = pageShortcuts[shortcutKey] || globalKeyboardShortcuts[shortcutKey];

        Logger.debugSync(`Shortcut key: ${shortcutKey}. Handler found? ${!!shortcutHandler}`);

        if (shortcutHandler) {
            e.preventDefault();
            shortcutHandler();

            // Reset after successful combination
            trackingState.lastKey = null;
            trackingState.lastKeyPressTime = 0;
        } else {
            // Update tracking for potential combination
            trackingState.lastKey = shortcutKey;
            trackingState.lastKeyPressTime = currentTime;
        }
    });
}
