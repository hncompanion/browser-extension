/**
 * HN Enhancer - Main Orchestrator
 * Coordinates all modules to provide enhanced Hacker News functionality.
 */

import HNState from './hnstate.js';
import SummaryPanel from './summary-panel.js';
import {browser} from "wxt/browser";
import {storage} from '#imports';
import {Logger, getTimeAgo} from "../../lib/utils.js";
import PostNavigator from './post-navigator.js';

// Import generic utilities from lib
import {buildFragment, createStrong, createInternalLink} from '../../lib/dom-utils.js';
import {stripAnchors} from '../../lib/text-utils.js';

// Import HN-specific DOM utilities
import {createHighlightedAuthor, createLoadingMessage} from './hn-dom-utils.js';

// Import help modal functions
import {createHelpModal, createHelpIcon, toggleHelpModal} from './help-modal.js';

// Import user popup functions
import {createAuthorPopup, setupUserHover} from './user-popup.js';

// Import comment navigator
import {CommentNavigator, createAuthorCommentsMap} from './comment-navigator.js';

// Import comment processor functions
import {getHNThread, createSummaryFragment} from './comment-processor.js';

// Import AI summarizer functions
import {
    getAIProviderModel,
    formatSummaryError,
    summarizeTextWithLLM,
    summarizeUsingOllama,
    createOllamaErrorMessage,
    getCachedSummary,
    serverCacheConfigEnabled
} from './ai-summarizer.js';

// Import keyboard shortcuts
import {setupKeyboardShortcuts} from './keyboard-shortcuts.js';

class HNEnhancer {

    static DEBUG = false;  // Set to true when debugging

    constructor() {

        if (HNEnhancer.DEBUG) {
            Logger.enableLoggingSync();
        }

        this.authorComments = createAuthorCommentsMap();
        this.popup = createAuthorPopup();
        this.userInfoCache = new Map();
        this.userPopupState = {isMouseOverUserOrPopup: false};
        this.postAuthor = this.getPostAuthor();

        // Initialize comment navigator
        this.commentNavigator = new CommentNavigator();

        this.helpModal = createHelpModal((show) => this.toggleHelpModal(show));
        createHelpIcon((show) => this.toggleHelpModal(show));

        // Initialize the page based on type
        if (this.isHomePage) {
            this.currentPostIndex = -1;
            this.allPosts = null;

            // Initialize posts navigator and attach the handler when sorting is complete
            this.postNavigator = new PostNavigator({
                onSortComplete: () => this.updatePostList()
            });

            this.initHomePageNavigation();

        } else if (this.isCommentsPage) {
            this.initCommentsPageNavigation();
            this.commentNavigator.setupCommentClickHandlers();
            this.commentNavigator.navigateToFirstComment(false);
            this.summaryPanel = new SummaryPanel();

            // Wire up refresh button to force-refresh summary
            if (this.summaryPanel) {
                this.summaryPanel.onRefresh = () => this.summarizeAllComments(true);
                this.summaryPanel.onHelp = () => this.toggleHelpModal(true);
                this.summaryPanel.onVisibilityChange = (isVisible) => {
                    // Hide floating help button when panel is open
                    const helpIcon = document.querySelector('.help-icon');
                    if (helpIcon) {
                        helpIcon.style.display = isVisible ? 'none' : 'flex';
                    }
                };
            }
        }

        // Set up all keyboard shortcuts
        this.setupKeyBoardShortcuts();
    }

    // Proxy getters/setters for backward compatibility
    get currentComment() {
        return this.commentNavigator.currentComment;
    }

    set currentComment(value) {
        this.commentNavigator.currentComment = value;
    }

    get isHomePage() {
        const pathname = window.location.pathname;
        return pathname === '/' || pathname === '/news' || pathname === '/newest' || pathname === '/ask' || pathname === '/show' || pathname === '/front' || pathname === '/shownew';
    }

    get isCommentsPage() {
        return window.location.pathname === '/item';
    }

    // ==================== Home Page Navigation ====================

    initHomePageNavigation() {
        this.allPosts = document.querySelectorAll('.athing');

        HNState.getLastSeenPostId().then(lastSeenPostId => {
            let lastSeenPostIndex = -1;
            if (lastSeenPostId) {
                Logger.debugSync(`Got last seen post id from storage: ${lastSeenPostId}`);
                const posts = Array.from(this.allPosts);
                lastSeenPostIndex = posts.findIndex(post => this.getPostId(post) === lastSeenPostId);
            }

            if (lastSeenPostIndex !== -1) {
                this.setCurrentPostIndex(lastSeenPostIndex);
            } else {
                this.navigateToPost('first');
            }
        });
    }

    getPostId(post) {
        const subtext = post.nextElementSibling;
        if (subtext) {
            const commentsLink = subtext.querySelector('a[href^="item?id="]');
            if (commentsLink) {
                const match = commentsLink.href.match(/id=(\d+)/);
                return match ? match[1] : null;
            }
        }
        return null;
    }

    navigateToPost(direction) {
        switch (direction) {
            case 'first':
                if (this.allPosts.length > 0) {
                    this.setCurrentPostIndex(0);
                }
                break;
            case 'next':
                const nextPostIndex = this.currentPostIndex + 1;
                if (nextPostIndex < this.allPosts.length) {
                    this.setCurrentPostIndex(nextPostIndex);
                } else {
                    Logger.debugSync(`Currently at the last post, cannot navigate further to next post.`);
                }
                break;
            case 'prev':
                const prevPostIndex = this.currentPostIndex - 1;
                if (prevPostIndex >= 0) {
                    this.setCurrentPostIndex(prevPostIndex);
                } else {
                    Logger.debugSync(`Currently at the first post, cannot navigate further to previous post.`);
                }
                break;
            default:
                Logger.infoSync(`Cannot navigate to post. Unknown direction: ${direction}`);
                break;
        }
    }

    getCurrentPost() {
        if (this.currentPostIndex < 0 || this.currentPostIndex >= this.allPosts.length) {
            Logger.infoSync(`No current post to return, because current post index is outside the bounds of the posts array.`);
            return null;
        }
        return this.allPosts[this.currentPostIndex];
    }

    setCurrentPostIndex(postIndex) {
        if (!this.allPosts) return;

        if (this.allPosts.length === 0) {
            Logger.debugSync(`No posts in this page, hence not setting the current post.`);
            return;
        }
        if (postIndex < 0 || postIndex >= this.allPosts.length) {
            Logger.infoSync(`ERROR: cannot set current post because the given index is outside the bounds of the posts array.`);
            return;
        }

        if (this.currentPostIndex >= 0) {
            const prevPost = this.allPosts[this.currentPostIndex];
            prevPost.classList.remove('highlight-post');
        }

        const newPost = this.allPosts[postIndex];
        if (!newPost) {
            Logger.infoSync(`Post at the new index is null. postIndex: ${postIndex}`);
            return;
        }

        this.currentPostIndex = postIndex;
        Logger.debugSync(`Updated current post index to ${postIndex}`);

        const newPostId = this.getPostId(newPost);
        if (newPostId) {
            HNState.saveLastSeenPostId(newPostId);
            Logger.debugSync(`Saved current post id as last seen post id: ${newPostId}`);
        }

        newPost.classList.add('highlight-post');
        newPost.scrollIntoView({behavior: 'smooth', block: 'center'});
    }

    updatePostList() {
        // Save reference to current post BEFORE updating the post list
        const currentPost = this.getCurrentPost();
        
        // Now update the post list
        this.allPosts = document.querySelectorAll('.athing:not(.comtr)');

        // Find the post's new position in the new list
        if (currentPost) {
            const currentId = currentPost.getAttribute('id');
            const posts = Array.from(this.allPosts);
            const newIndex = posts.findIndex(post => post.getAttribute('id') === currentId);
            if (newIndex !== -1) {
                this.currentPostIndex = newIndex;
            }
        }
    }

    // ==================== Comments Page Navigation ====================

    initCommentsPageNavigation() {
        this.injectSummarizePostLink();
        this.injectPostAuthorNavLinks();

        const allComments = document.querySelectorAll('.athing.comtr');

        allComments.forEach(comment => {
            this.injectAuthorCommentsNavLinks(comment);
            this.customizeDefaultNavLinks(comment);
        });

        setupUserHover(this.popup, this.userInfoCache, this.userPopupState);
    }

    injectPostAuthorNavLinks() {
        const subline = document.querySelector('.subtext .subline');
        if (!subline) return;

        const authorElement = subline.querySelector('.hnuser');
        if (!authorElement) return;

        const author = authorElement.textContent;
        const authorCommentsList = this.authorComments.get(author) || [];
        const count = authorCommentsList.length;

        // Add icon before author name (not clickable, just indicator)
        const authorIcon = document.createElement('span');
        authorIcon.className = 'post-author-icon';
        authorIcon.setAttribute('role', 'img');
        authorIcon.setAttribute('aria-label', 'Original poster');
        authorIcon.title = 'Original poster (OP)';
        authorIcon.innerHTML = this.getAuthorIconSVG();
        authorElement.parentElement.insertBefore(authorIcon, authorElement);

        if (count > 0) {
            // Create container for post author navigation
            const navContainer = document.createElement('span');
            navContainer.className = 'post-author-nav';

            // Add comment count with tooltip
            const countSpan = document.createElement('span');
            countSpan.className = 'comment-count';
            countSpan.textContent = `(${count})`;
            countSpan.title = `${author} has ${count} comment${count !== 1 ? 's' : ''} in this discussion`;
            navContainer.appendChild(countSpan);

            // Add navigation triangle to jump to first OP comment
            const navNext = document.createElement('span');
            navNext.className = 'author-nav nav-triangle';
            navNext.textContent = '\u25B6';  // ▶
            navNext.title = 'Jump to first comment by OP';
            navNext.onclick = (e) => {
                e.preventDefault();
                this.navigateToAuthorFirstComment(author);
            };
            navContainer.appendChild(navNext);

            // Add pipe separator
            const separator = document.createElement("span");
            separator.className = "author-separator";
            separator.textContent = "|";
            navContainer.appendChild(separator);

            authorElement.parentElement.insertBefore(navContainer, authorElement.nextSibling);
        }
    }

    injectAuthorCommentsNavLinks(comment) {
        const authorElement = comment.querySelector('.hnuser');
        if (authorElement && !authorElement.querySelector('.comment-count')) {
            const author = authorElement.textContent;
            const authorCommentsList = this.authorComments.get(author);
            const count = authorCommentsList.length;
            const position = authorCommentsList.indexOf(comment) + 1;  // 1-based position

            if (author === this.postAuthor) {
                const authorIcon = document.createElement('span');
                authorIcon.className = 'post-author-icon';
                authorIcon.setAttribute('role', 'img');
                authorIcon.setAttribute('aria-label', 'Original poster');
                authorIcon.title = 'Original poster (OP)';
                authorIcon.innerHTML = this.getAuthorIconSVG();
                authorElement.parentElement.insertBefore(authorIcon, authorElement);
            }

            const container = document.createElement('span');

            const countSpan = document.createElement('span');
            countSpan.className = 'comment-count';
            countSpan.textContent = count > 1 ? `(${position}/${count})` : `(${count})`;
            container.appendChild(countSpan);

            const navPrev = document.createElement('span');
            navPrev.className = 'author-nav nav-triangle';
            navPrev.textContent = '\u23F4';  // Unicode for left arrow '◀'
            navPrev.title = 'Go to previous comment by this author';
            navPrev.onclick = (e) => {
                e.preventDefault();
                this.navigateAuthorComments(author, comment, 'prev');
            };
            container.appendChild(navPrev);

            const navNext = document.createElement('span');
            navNext.className = 'author-nav nav-triangle';
            navNext.textContent = '\u23F5';   // Unicode for right arrow '▶'
            navNext.title = 'Go to next comment by this author';
            navNext.onclick = (e) => {
                e.preventDefault();
                this.navigateAuthorComments(author, comment, 'next');
            };
            container.appendChild(navNext);

            const separator = document.createElement("span");
            separator.className = "author-separator";
            separator.textContent = "|";
            container.appendChild(separator);

            authorElement.parentElement.insertBefore(container, authorElement.nextSibling);
        }
    }

    customizeDefaultNavLinks(comment) {
        const hyperLinks = comment.querySelectorAll('.comhead .navs a');
        if (!hyperLinks) return;

        const navLinks = Array.from(hyperLinks).filter(link => link.hash.length > 0);

        navLinks.forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                const targetComment = this.getNavElementByName(comment, link.textContent.trim());
                if (targetComment) {
                    this.setCurrentComment(targetComment);
                }
            };
        });
    }

    injectSummarizePostLink() {
        const navLinks = document.querySelector('.subtext .subline');
        if (!navLinks) return;

        const summarizeLink = document.createElement('a');
        summarizeLink.href = '#';
        summarizeLink.textContent = 'summarize all comments';

        summarizeLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.summarizeAllComments();
        });

        navLinks.appendChild(document.createTextNode(' | '));
        navLinks.appendChild(summarizeLink);
    }

    // ==================== Comment Navigation Proxies ====================

    setCurrentComment(comment, scrollIntoView = true, saveState = true) {
        this.commentNavigator.setCurrentComment(comment, scrollIntoView, saveState);
    }

    navigateToFirstComment(scrollToComment = true) {
        this.commentNavigator.navigateToFirstComment(scrollToComment);
    }

    navigateToChildComment(forward = true) {
        this.commentNavigator.navigateToChildComment(forward);
    }

    getNavElementByName(comment, elementName) {
        return this.commentNavigator.getNavElementByName(comment, elementName);
    }

    navigateAuthorComments(author, currentComment, direction) {
        this.commentNavigator.navigateAuthorComments(author, currentComment, direction, this.authorComments);
    }

    undoNavigation() {
        this.commentNavigator.undoNavigation();
    }

    // ==================== Help Modal ====================

    toggleHelpModal(show) {
        toggleHelpModal(this.helpModal, show);
    }

    // ==================== Utilities ====================

    getPostAuthor() {
        const postAuthorElement = document.querySelector('.fatitem .hnuser');
        return postAuthorElement ? postAuthorElement.textContent : null;
    }

    getCurrentHNItemId() {
        return new URLSearchParams(window.location.search).get('id');
    }

    getHNPostTitle() {
        return document.title;
    }

    openOptionsPage() {
        browser.runtime.sendMessage({
            type: 'HN_SHOW_OPTIONS',
            data: {}
        }).catch(error => {
            Logger.errorSync('Error sending message to show options:', error);
        });
    }

    // ==================== Keyboard Shortcuts ====================

    setupKeyBoardShortcuts() {
        setupKeyboardShortcuts({
            isHomePage: this.isHomePage,
            isCommentsPage: this.isCommentsPage,
            handlers: {
                // Home page handlers
                navigateToPost: (dir) => this.navigateToPost(dir),
                getCurrentPost: () => this.getCurrentPost(),
                cycleSortMode:  () => this.postNavigator.cycleSortMode(),

                // Comments page handlers
                commentNavigator: this.commentNavigator,
                getNavElementByName: (comment, name) => this.getNavElementByName(comment, name),
                setCurrentComment: (comment) => this.setCurrentComment(comment),
                navigateToChildComment: (forward) => this.navigateToChildComment(forward),
                navigateAuthorComments: (author, comment, dir) => this.navigateAuthorComments(author, comment, dir),
                navigateToFirstComment: () => this.navigateToFirstComment(),
                undoNavigation: () => this.undoNavigation(),
                summaryPanel: this.summaryPanel,
                summarizeAllComments: async () => await this.summarizeAllComments(),

                // Global handlers
                helpModal: this.helpModal,
                toggleHelpModal: (show) => this.toggleHelpModal(show)
            }
        });
    }

    // ==================== Summarization ====================

    async summarizeAllComments(skipCache = false) {
        const postId = this.getCurrentHNItemId();
        if (!postId) {
            await Logger.error(`Could not get item id of the current post to summarize all comments in it.`);
            return;
        }

        if (!this.summaryPanel.isVisible) {
            this.summaryPanel.toggle();
        }

        const cacheConfigEnabled = await serverCacheConfigEnabled();
        if (cacheConfigEnabled && !skipCache) {
            this.summaryPanel.updateContent({
                text: createLoadingMessage([
                    'Looking for cached summary on HNCompanion server...'
                ]),
                metadata: { state: 'loading', statusText: 'Checking cache...' }
            });

            const cacheResult = await getCachedSummary(postId);
            const cachedSummary = cacheResult?.summary;
            if (cachedSummary && cachedSummary.length > 0) {
                await Logger.info(`Using cached summary from HNCompanion server for post ${postId}`);
                const timeAgo = getTimeAgo(cacheResult.created_at);
                await this.showSummaryInPanel(cachedSummary, true, timeAgo, null, postId);
                return;
            }
            await Logger.info(`No cached summary found for post ID ${postId}. Generating fresh summary using configured AI provider`);
        }

        try {
            const {aiProvider, model} = await getAIProviderModel();

            if (!aiProvider) {
                await Logger.info('AI provider not configured. Prompting user to complete setup.');
                this.showConfigureAIMessage();
                return;
            }

            const loadingParts = ['Generating summary'];
            if (aiProvider) {
                loadingParts.push(' using ', createStrong(`${aiProvider}/${model || ''}`));
            }
            loadingParts.push('... This may take a few moments. ');
            this.summaryPanel.updateContent({
                text: createLoadingMessage(loadingParts),
                metadata: { state: 'loading', statusText: 'Generating...', provider: aiProvider ? `${aiProvider}/${model || ''}` : undefined }
            });

            const threadData = await getHNThread(postId);
            if (!threadData || !threadData.formattedComment) {
                await Logger.error(`Could not get thread data for post summarization. item id: ${postId}`);
                this.summaryPanel.updateContent({
                    text: 'Failed to retrieve comments for summarization. Please try again.',
                    metadata: { state: 'error' }
                });
                return;
            }
            await this.summarizeText(threadData.formattedComment, threadData.commentPathToIdMap, postId);

        } catch (error) {
            await Logger.error('Error preparing for summarization:', error);
            this.summaryPanel.updateContent({
                text: `Error preparing for summarization: ${error.message}`,
                metadata: { state: 'error' }
            });
        }
    }

    async summarizeText(formattedComment, commentPathToIdMap, itemId) {
        const settings = await storage.getItem('sync:settings');
        try {
            const aiProvider = settings?.providerSelection;
            const model = settings?.[aiProvider]?.model;

            if (!aiProvider) {
                await Logger.info('AI provider not configured. Prompting user to complete setup.');
                this.showConfigureAIMessage();
                return;
            }

            Logger.infoSync(`Summarization - AI Provider: ${aiProvider}, Model: ${model || 'none'}`);

            formattedComment = stripAnchors(formattedComment);
            const postTitle = this.getHNPostTitle();

            const onSuccess = (summary, duration, pathMap) => {
                this.showSummaryInPanel(summary, false, duration, pathMap, itemId).catch(error => {
                    Logger.errorSync('Error showing summary:', error);
                });
            };

            const onError = (error) => {
                this.handleSummaryError(error);
            };

            switch (aiProvider) {
                case 'none':
                    this.showSummaryInPanel(formattedComment, true, 0, commentPathToIdMap, itemId).catch(error => {
                        Logger.errorSync('Error showing summary:', error);
                    });
                    break;
                case 'ollama':
                    const ollamaUrl = settings?.ollama?.url || 'http://localhost:11434';
                    await summarizeUsingOllama(
                        formattedComment, model, ollamaUrl, commentPathToIdMap,
                        onSuccess,
                        (error) => {
                            const errorFragment = createOllamaErrorMessage(error);
                            this.summaryPanel.updateContent({
                                text: errorFragment,
                                metadata: { state: 'error', provider: 'ollama' }
                            });
                        },
                        postTitle
                    );
                    break;
                case 'openai':
                case 'anthropic':
                case 'google':
                case 'openrouter':
                    const apiKey = settings?.[aiProvider]?.apiKey;
                    await summarizeTextWithLLM(
                        aiProvider, model, apiKey, formattedComment, commentPathToIdMap,
                        onSuccess, onError, postTitle
                    );
                    break;
                default:
                    const errorMessage = `Unsupported AI provider: ${aiProvider}, Model: ${model}`;
                    await Logger.error(errorMessage);
                    this.handleSummaryError(errorMessage);
            }
        } catch (error) {
            this.handleSummaryError(error);
        }
    }

    handleSummaryError(error) {
        const errorMessage = formatSummaryError(error);
        this.summaryPanel.updateContent({
            text: errorMessage,
            metadata: { state: 'error' }
        });
    }

    showConfigureAIMessage() {
        const message = buildFragment([
            'To use the summarization feature, you need to configure an AI provider.',
            document.createElement('br'),
            document.createElement('br'),
            createInternalLink('options-page-link', 'Open settings page'),
            ' to select your preferred LLM provider and configure your API key.'
        ]);

        this.summaryPanel.updateContent({
            text: message,
            metadata: { state: 'setup-required' }
        });

        const optionsLink = this.summaryPanel.panel.querySelector('#options-page-link');
        if (optionsLink) {
            optionsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openOptionsPage();
            });
        }
    }

    async showSummaryInPanel(summary, fromCache, duration, commentPathToIdMap = null, postId = null) {
        const formattedSummary = createSummaryFragment(summary, commentPathToIdMap);

        let metadata;
        if (fromCache) {
            metadata = {
                state: 'cached',
                statusText: duration ? `${duration} ago` : undefined,
                provider: 'HN Companion',
                providerUrl: 'https://hncompanion.com'
            };
        } else {
            const {aiProvider, model} = await getAIProviderModel();
            metadata = {
                state: 'generated',
                provider: aiProvider ? `${aiProvider}/${model || ''}` : undefined,
                generationTime: duration ? `${duration}s` : undefined
            };
        }

        this.summaryPanel.updateContent({
            text: formattedSummary,
            metadata,
            rawMarkdown: summary,
            commentPathToIdMap,
            postId
        });

        const optionsLink = this.summaryPanel.panel.querySelector('#options-page-link');
        if (optionsLink) {
            optionsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openOptionsPage();
            });
        }

        document.querySelectorAll('[data-comment-link="true"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = link.dataset.commentId;
                const comment = document.getElementById(id);
                if (comment) {
                    this.setCurrentComment(comment);
                } else {
                    Logger.infoSync('Failed to find DOM element for comment id:', id);
                }
            });
        });
    }

    navigateToAuthorFirstComment(author) {
        this.commentNavigator.navigateToAuthorFirstComment(author, this.authorComments);
    }

    getAuthorIconSVG() {
        return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"> <path d="M26,33.6c6.9,0,12.4-5.6,12.4-12.4s-5.6-12.4-12.4-12.4-12.4,5.6-12.4,12.4h0c0,6.9,5.6,12.4,12.4,12.4ZM26,10.7c5.8,0,10.4,4.7,10.4,10.4s-4.7,10.4-10.4,10.4c-5.8,0-10.4-4.7-10.4-10.4h0c0-5.8,4.7-10.4,10.4-10.4h0Z"/> <path d="M31.1,52.7H6.8c-1,0-1.7-.8-1.8-1.8v-5c0-3.7,2.4-7,5.9-8.2l7-2.3c5,2.8,11.1,2.8,16.1,0l1.2.4c.5.2,1.1-.1,1.3-.6.2-.5-.1-1.1-.6-1.3l-1.6-.5c-.3,0-.6,0-.8,0-4.6,2.8-10.3,2.8-14.8,0-.3-.2-.6-.2-.8,0l-7.5,2.5c-4.3,1.4-7.3,5.5-7.3,10.1v5c0,2.1,1.7,3.7,3.8,3.8h24.3c.6,0,1-.4,1-1,0-.6-.4-1-1-1,0,0,0,0,0,0h0Z"/> <path d="M59.9,20.8c-5,.7-9.8,2.7-14,5.7-.5.7-.9,1.5-1.3,2.3-.4-.4-1-.5-1.4-.1,0,0,0,0,0,0-.8.8-1.6,1.6-2.4,2.4-.9,1.2-2.4,2.2-2.3,3.8-1,0-1.2,1.2-1.7,1.8-.2.4-4.6,8.4.4,11.9-.6,1.6-1.1,3.4-1.6,5.4-.1.5.2,1.1.7,1.2.5.1,1.1-.2,1.2-.7,0,0,0,0,0,0,.5-1.9,1-3.6,1.6-5.3,2.5.1,9-1,10.1-5.8,0-.8,1-2,.4-2.8.3-.1.6-.3.7-.6.3-.9.6-1.8,1-2.7.3-1,1-2.2,1.3-3.5,0-.3-.1-.6-.3-.7l1.2-1.1c.5-.7,1.1-2.1,1.6-2.9,2.8-5.2,4.6-6.1,5.2-6.3.5-.1.9-.7.7-1.2-.1-.5-.6-.8-1.1-.8ZM53.3,28.1c-.3.6-1,1.8-1.4,2.6l-2.5,2.4c-.4.4-.4,1,0,1.4,0,0,.2.2.3.2.8.1-.3,1.4-.3,1.9-.3.8-.6,1.6-.9,2.4l-2.9,1.3c-.5.2-.7.8-.5,1.3,0,.2.3.4.5.5.6.3,1.2.4,1.8.4-.1.6-.4,1.3-.8,1.8-1.5,2.3-4.9,2.8-6.7,2.9,1.4-3.8,3.3-7.3,5.7-10.6.3-.4.2-1.1-.2-1.4-.4-.3-1-.2-1.4.2-2.5,3.5-4.5,7.2-6,11.2-2.3-2.4-.2-7.3.5-8.6.3.4.9.6,1.4.4.3-.2.5-.5.5-.8l.2-3c.9-1.3,1.9-2.4,3-3.5.5.7,1.6,1.1,2.1.2l1.7-3.3c2.7-1.9,5.6-3.3,8.8-4.2-1.1,1.4-2,2.8-2.8,4.4Z"/></svg>';
    }
}

export default HNEnhancer;
