/**
 * Comment Navigator Module
 * Comment focus, traversal, and navigation state management.
 */

import {Logger} from "../../lib/utils.js";

/**
 * Creates a CommentNavigator instance for managing comment navigation state.
 */
export class CommentNavigator {
    constructor() {
        this.currentComment = null;
        this.navigationHistory = [];
        this.maxHistorySize = 10;
    }

    /**
     * Gets the navigation element by name from HN's default nav panel.
     * @param {HTMLElement} comment - The comment element
     * @param {string} elementName - 'root', 'parent', 'next', or 'prev'
     * @returns {HTMLElement|undefined}
     */
    getNavElementByName(comment, elementName) {
        if (!comment) return;

        const hyperLinks = comment.querySelectorAll('.comhead .navs a');
        if (hyperLinks) {
            const hyperLink = Array.from(hyperLinks).find(a => a.textContent.trim() === elementName);
            if (hyperLink) {
                const commentId = hyperLink.hash.split('#')[1];
                return document.getElementById(commentId);
            }
        }
    }

    /**
     * Sets the current comment and handles highlighting/scrolling.
     * @param {HTMLElement} comment - The comment to focus
     * @param {boolean} scrollIntoView - Whether to scroll to the comment
     * @param {boolean} saveState - Whether to save navigation state
     */
    setCurrentComment(comment, scrollIntoView = true, saveState = true) {
        if (!comment) return;

        // Save current position to history before changing focus
        if (this.currentComment && saveState) {
            this.saveNavigationState(this.currentComment);
        }

        // Un-highlight the current comment's author before updating
        if (this.currentComment) {
            const prevAuthorElement = this.currentComment.querySelector('.hnuser');
            if (prevAuthorElement) {
                prevAuthorElement.classList.remove('highlight-author');
            }
        }

        // Update the current comment
        this.currentComment = comment;

        // Highlight the new comment's author
        const newAuthorElement = comment.querySelector('.hnuser');
        if (newAuthorElement) {
            newAuthorElement.classList.add('highlight-author');
        }

        // Scroll to the new comment element if requested
        if (scrollIntoView) {
            comment.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }

    /**
     * Navigates to the first comment on the page.
     * @param {boolean} scrollToComment - Whether to scroll to the comment
     */
    navigateToFirstComment(scrollToComment = true) {
        const firstComment = document.querySelector('.athing.comtr');
        if (firstComment) {
            this.setCurrentComment(firstComment, scrollToComment);
        }
    }

    /**
     * Navigates to the next/previous comment without hierarchy.
     * @param {boolean} forward - Direction of navigation
     */
    navigateToChildComment(forward = true) {
        if (!this.currentComment) return;

        let sibling = forward
            ? this.currentComment.nextElementSibling
            : this.currentComment.previousElementSibling;

        while (sibling) {
            if (sibling.classList.contains('athing') && sibling.classList.contains('comtr')) {
                // Skip hidden comments
                if (sibling.classList.contains('noshow')) {
                    sibling = forward
                        ? sibling.nextElementSibling
                        : sibling.previousElementSibling;
                    continue;
                }
                this.setCurrentComment(sibling);
                return;
            }
            sibling = forward
                ? sibling.nextElementSibling
                : sibling.previousElementSibling;
        }
    }

    /**
     * Navigates between comments by the same author.
     * @param {string} author - The author name
     * @param {HTMLElement} currentComment - The current comment
     * @param {string} direction - 'prev' or 'next'
     * @param {Map} authorComments - Map of author to their comments
     */
    navigateAuthorComments(author, currentComment, direction, authorComments) {
        const comments = authorComments.get(author);
        if (!comments) return;

        const currentIndex = comments.indexOf(currentComment);
        if (currentIndex === -1) return;

        let targetIndex = currentIndex;
        const total = comments.length;

        for (let i = 0; i < total; i++) {
            if (direction === 'prev') {
                targetIndex = targetIndex > 0 ? targetIndex - 1 : total - 1;
            } else {
                targetIndex = targetIndex < total - 1 ? targetIndex + 1 : 0;
            }
            const targetComment = comments[targetIndex];
            if (!targetComment.classList.contains('noshow')) {
                this.setCurrentComment(targetComment);
                break;
            }
        }
    }

    /**
     * Navigates to the first comment by a specific author.
     * @param {string} author - The author name
     * @param {Map} authorComments - Map of author to their comments
     */
    navigateToAuthorFirstComment(author, authorComments) {
        const comments = authorComments.get(author);
        if (comments && comments.length > 0) {
            this.setCurrentComment(comments[0]);
        }
    }

    /**
     * Saves navigation state for undo functionality.
     * @param {HTMLElement} comment - The comment to save
     */
    saveNavigationState(comment) {
        if (!comment) return;

        // Don't save if it's the same comment
        if (this.navigationHistory.length > 0 &&
            this.navigationHistory[this.navigationHistory.length - 1].comment === comment) {
            return;
        }

        // Add to history
        this.navigationHistory.push({
            comment: comment,
            timestamp: Date.now()
        });

        // Maintain history size limit
        if (this.navigationHistory.length > this.maxHistorySize) {
            this.navigationHistory.shift();
        }

        Logger.debugSync(`Navigation state saved. History length: ${this.navigationHistory.length}`);
    }

    /**
     * Undoes the last navigation action.
     */
    undoNavigation() {
        if (this.navigationHistory.length === 0) {
            Logger.debugSync('No navigation history available for undo');
            return;
        }

        const lastState = this.navigationHistory[this.navigationHistory.length - 1];

        // If the last state is the current comment, we need to go back further
        if (lastState.comment === this.currentComment && this.navigationHistory.length > 1) {
            this.navigationHistory.pop();
            const previousState = this.navigationHistory[this.navigationHistory.length - 1];
            this.setCurrentComment(previousState.comment, true, false);
            Logger.debugSync('Undid navigation to comment:', previousState.comment.id);
        } else if (lastState.comment !== this.currentComment) {
            this.setCurrentComment(lastState.comment, true, false);
            Logger.debugSync('Undid navigation to comment:', lastState.comment.id);
        } else {
            Logger.debugSync('No previous navigation state to undo to');
        }
    }

    /**
     * Sets up click handlers for comment focus functionality.
     */
    setupCommentClickHandlers() {
        const allComments = document.querySelectorAll('.comment');

        allComments.forEach(comment => {
            comment.addEventListener('click', () => {
                // Save current position to history before changing focus
                this.saveNavigationState(this.currentComment);

                // Find the parent DOM element with class="athing comtr"
                const commentElement = comment.closest('.athing.comtr');
                // Set this comment as the current focus
                this.setCurrentComment(commentElement, false);

                Logger.debugSync('Comment focused via click:', commentElement.id);
            });
        });

        Logger.debugSync(`Set up click handlers for ${allComments.length} comments`);
    }
}

/**
 * Creates a map of comment elements by author.
 * @returns {Map<string, HTMLElement[]>}
 */
export function createAuthorCommentsMap() {
    const authorCommentsMap = new Map();

    const comments = document.querySelectorAll('.athing.comtr');

    comments.forEach(comment => {
        const authorElement = comment.querySelector('.hnuser');
        if (authorElement) {
            const author = authorElement.textContent;

            if (!authorCommentsMap.has(author)) {
                authorCommentsMap.set(author, []);
            }
            authorCommentsMap.get(author).push(comment);
        }
    });

    return authorCommentsMap;
}
