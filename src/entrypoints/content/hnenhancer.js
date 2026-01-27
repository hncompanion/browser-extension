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

        const authorIcon = document.createElement('span');
        authorIcon.className = 'post-author-icon';
        authorIcon.innerHTML = this.getAuthorIconSVG();

        if (count > 0) {
            const onActivate = (e) => {
                e.preventDefault();
                this.navigateToAuthorFirstComment(author);
            };

            authorIcon.classList.add('is-clickable');
            authorIcon.setAttribute('role', 'button');
            authorIcon.setAttribute('tabindex', '0');
            authorIcon.setAttribute('aria-label', 'Jump to first comment by the original poster');
            authorIcon.title = 'Jump to first comment by the original poster';
            authorIcon.addEventListener('click', onActivate);
            authorIcon.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    onActivate(e);
                }
            });
        } else {
            authorIcon.setAttribute('role', 'img');
            authorIcon.setAttribute('aria-label', 'Post author');
            authorIcon.title = 'Post author';
        }

        authorElement.parentElement.insertBefore(authorIcon, authorElement);

        if (count > 0) {
            const countSpan = document.createElement('span');
            countSpan.className = 'comment-count';
            countSpan.textContent = `(${count})`;
            authorElement.parentElement.insertBefore(countSpan, authorElement.nextSibling);
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
                authorIcon.setAttribute('aria-label', 'Post author');
                authorIcon.title = 'Post author';
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
        return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="m26.97574 31.07234a12.44592 12.44592 0 1 0 -12.44519-12.44568 12.46036 12.46036 0 0 0 12.44519 12.44568zm0-22.89124a10.44532 10.44532 0 1 1 -10.44459 10.44556 10.45756 10.45756 0 0 1 10.44459-10.444556z"/><path d="m32.0681 50.19388h-24.31696a1.75266 1.75266 0 0 1 -1.75053-1.75054v-4.97123a8.61015 8.61015 0 0 1 5.88948-8.17436l7.02655-2.34837a16.38434 16.38434 0 0 0 16.11721.002l1.17715.39562a1.00056 1.00056 0 0 0 .63691-1.89706l-1.60991-.54025a1.00311 1.00311 0 0 0 -.83814.09378 14.37247 14.37247 0 0 1 -14.84534 0 1.03345 1.03345 0 0 0 -.84791-.09378l-7.45051 2.491a10.60639 10.60639 0 0 0 -7.2561 10.07142v4.97123a3.75587 3.75587 0 0 0 3.75114 3.75115h24.317a1.00031 1.00031 0 1 0 0-2.00061z"/><path d="m58.87313 23.32389a31.60233 31.60233 0 0 0 -13.96518 5.658 14.93016 14.93016 0 0 0 -1.30417 2.34642 1.00894 1.00894 0 0 0 -1.44765-.11381 28.88549 28.88549 0 0 0 -2.36888 2.39917c-.88143 1.18627-2.38262 2.23512-2.30832 3.82337-.9699-.015-1.24147 1.179-1.70859 1.83845-.1947.35161-4.57115 8.43268.35069 11.93679-.57854 1.64241-1.13407 3.42512-1.63715 5.35466a1.00033 1.00033 0 1 0 1.93612.50406c.49442-1.89657 1.03932-3.64668 1.6062-5.25288 2.51731.13853 8.99328-1.02766 10.08181-5.82.07094-.76323.96916-1.96055.42713-2.7907a1.07345 1.07345 0 0 0 .67-.64082c.30283-.85964.635-1.77105 1.01789-2.7313.33292-1.03779 1.0304-2.24519 1.34721-3.48348a.9967.9967 0 0 0 -.33519-.74828l1.17907-1.13218c.53032-.746 1.08078-2.074 1.59918-2.91983 2.84553-5.22864 4.60193-6.121 5.22419-6.26167a1.00147 1.00147 0 0 0 -.36436-1.96597zm-6.61236 7.26442c-.32725.58855-.97 1.78765-1.35686 2.56035l-2.531 2.42945a1.00665 1.00665 0 0 0 .28329 1.63428c.84773.11753-.26119 1.36412-.29581 1.89511-.33036.82642-.62635 1.62745-.89889 2.39037l-2.9345 1.33342a1.00712 1.00712 0 0 0 -.00678 1.81891 4.66681 4.66681 0 0 0 1.76513.43861 5.41589 5.41589 0 0 1 -.75707 1.80328c-1.54353 2.28335-4.85928 2.79431-6.74228 2.89691a46.33282 46.33282 0 0 1 5.65012-10.6014 1.00069 1.00069 0 0 0 -1.60012-1.20148 48.60443 48.60443 0 0 0 -5.96471 11.20745c-2.30368-2.40747-.18359-7.26356.47189-8.60124a1.26962 1.26962 0 0 0 1.43012.376.99841.99841 0 0 0 .549-.83417l.17877-2.995a30.69341 30.69341 0 0 1 3.04581-3.54116c.46449.72489 1.58843 1.089 2.05439.18548l1.69573-3.34073a29.61872 29.61872 0 0 1 8.77611-4.24494 30.61477 30.61477 0 0 0 -2.81234 4.3905z"/></svg>';
    }
}

export default HNEnhancer;
