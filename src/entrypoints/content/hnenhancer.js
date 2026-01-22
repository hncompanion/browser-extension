/**
 * HN Enhancer - Main Orchestrator
 * Coordinates all modules to provide enhanced Hacker News functionality.
 */

import HNState from './hnstate.js';
import SummaryPanel from './summary-panel.js';
import {browser} from "wxt/browser";
import {storage} from '#imports';
import {Logger, getTimeAgo} from "../../lib/utils.js";

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
    SummarizeCheckStatus,
    getAIProviderModel,
    shouldSummarizeText,
    createSummarizationErrorContent,
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

            this.initHomePageNavigation();

        } else if (this.isCommentsPage) {
            this.initCommentsPageNavigation();
            this.commentNavigator.setupCommentClickHandlers();
            this.commentNavigator.navigateToFirstComment(false);
            this.summaryPanel = new SummaryPanel();
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

    // ==================== Comments Page Navigation ====================

    initCommentsPageNavigation() {
        this.injectSummarizePostLink();

        const allComments = document.querySelectorAll('.athing.comtr');

        allComments.forEach(comment => {
            this.injectAuthorCommentsNavLinks(comment);
            this.customizeDefaultNavLinks(comment);
            this.injectSummarizeThreadLinks(comment);
        });

        setupUserHover(this.popup, this.userInfoCache, this.userPopupState);
    }

    injectAuthorCommentsNavLinks(comment) {
        const authorElement = comment.querySelector('.hnuser');
        if (authorElement && !authorElement.querySelector('.comment-count')) {
            const author = authorElement.textContent;
            const authorCommentsList = this.authorComments.get(author);
            const count = authorCommentsList.length;
            const position = authorCommentsList.indexOf(comment) + 1;  // 1-based position

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

            if (author === this.postAuthor) {
                const authorIndicator = document.createElement('span');
                authorIndicator.className = 'post-author';
                authorIndicator.textContent = '👑';
                authorIndicator.title = 'Post Author';
                container.appendChild(authorIndicator);
            }

            const separator = document.createElement("span");
            separator.className = "author-separator";
            separator.textContent = "|";
            container.appendChild(separator);

            authorElement.parentElement.insertBefore(container, authorElement.parentElement.children[1]);
        }
    }

    injectSummarizeThreadLinks(comment) {
        const navsElement = comment.querySelector('.navs');
        if (!navsElement) {
            Logger.infoSync('Could not find the navs element to inject the summarize thread link');
            return;
        }

        navsElement.appendChild(document.createTextNode(' | '));

        const summarizeThreadLink = document.createElement('a');
        summarizeThreadLink.href = '#';
        summarizeThreadLink.textContent = 'summarize thread';
        summarizeThreadLink.title = 'Summarize all child comments in this thread';

        summarizeThreadLink.addEventListener('click', async (e) => {
            e.preventDefault();
            this.setCurrentComment(comment);
            await this.summarizeThread(comment);
        });

        navsElement.appendChild(summarizeThreadLink);
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

    async summarizeThread(comment) {
        const itemLinkElement = comment.querySelector('.age')?.getElementsByTagName('a')[0];
        if (!itemLinkElement) {
            await Logger.error('Could not find the item link element to get the item id for summarization');
            return;
        }

        const itemId = itemLinkElement.href.split('=')[1];
        const threadData = await getHNThread(itemId);
        if (!threadData || !threadData.formattedComment) {
            await Logger.error(`Could not get the thread for summarization. item id: ${itemId}`);
            return;
        }
        const {formattedComment, commentPathToIdMap} = threadData;

        const commentDepth = commentPathToIdMap.size;
        const {aiProvider, model} = await getAIProviderModel();

        if (!aiProvider) {
            await Logger.info('AI provider not configured. Prompting user to complete setup.');
            this.showConfigureAIMessage();
            return;
        }

        const authorElement = comment.querySelector('.hnuser');
        const author = authorElement.textContent || '';

        const summarizeCheckResult = shouldSummarizeText(formattedComment, commentDepth, aiProvider);

        if (summarizeCheckResult.status !== SummarizeCheckStatus.OK) {
            const errorContent = createSummarizationErrorContent(summarizeCheckResult.status, author, aiProvider);
            this.summaryPanel.updateContent(errorContent);

            const optionsLink = this.summaryPanel.panel.querySelector('#options-page-link');
            if (optionsLink) {
                optionsLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openOptionsPage();
                });
            }
            return;
        }

        // Show in-progress message
        const metadata = buildFragment([
            'Analyzing discussion in ',
            createHighlightedAuthor(author),
            ' thread'
        ]);
        const loadingParts = ['Generating summary'];
        if (aiProvider) {
            loadingParts.push(' using ', createStrong(`${aiProvider}/${model || ''}`));
        }
        loadingParts.push('... This may take a few moments.');

        this.summaryPanel.updateContent({
            title: 'Thread Summary',
            metadata: metadata,
            text: createLoadingMessage(loadingParts)
        });

        await this.summarizeText(formattedComment, commentPathToIdMap);
    }

    async summarizeAllComments(skipCache = false) {
        const itemId = this.getCurrentHNItemId();
        if (!itemId) {
            await Logger.error(`Could not get item id of the current post to summarize all comments in it.`);
            return;
        }

        if (!this.summaryPanel.isVisible) {
            this.summaryPanel.toggle();
        }

        const cacheConfigEnabled = await serverCacheConfigEnabled();
        if (cacheConfigEnabled && !skipCache) {
            this.summaryPanel.updateContent({
                title: 'Discussion Summary',
                metadata: 'Analyzing all threads in this post...',
                text: createLoadingMessage([
                    'Looking for cached summary on HNCompanion server...'
                ])
            });

            const cacheResult = await getCachedSummary(itemId);
            const cachedSummary = cacheResult?.summary;
            if (cachedSummary && cachedSummary.length > 0) {
                await Logger.info(`Using cached summary from HNCompanion server for post ${itemId}`);
                const timeAgo = getTimeAgo(cacheResult.created_at);
                await this.showSummaryInPanel(cachedSummary, true, timeAgo, null);
                return;
            }
            await Logger.info(`No cached summary found for post ID ${itemId}. Generating fresh summary using configured AI provider`);
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
                title: 'Discussion Summary',
                metadata: `Analyzing all threads in this post...`,
                text: createLoadingMessage(loadingParts)
            });

            const threadData = await getHNThread(itemId);
            if (!threadData || !threadData.formattedComment) {
                await Logger.error(`Could not get thread data for post summarization. item id: ${itemId}`);
                this.summaryPanel.updateContent({
                    title: 'Error',
                    metadata: '',
                    text: 'Failed to retrieve comments for summarization. Please try again.'
                });
                return;
            }
            await this.summarizeText(threadData.formattedComment, threadData.commentPathToIdMap);

        } catch (error) {
            await Logger.error('Error preparing for summarization:', error);
            this.summaryPanel.updateContent({
                title: 'Summarization Error',
                metadata: '',
                text: `Error preparing for summarization: ${error.message}`
            });
        }
    }

    async summarizeText(formattedComment, commentPathToIdMap) {
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
                this.showSummaryInPanel(summary, false, duration, pathMap).catch(error => {
                    Logger.errorSync('Error showing summary:', error);
                });
            };

            const onError = (error) => {
                this.handleSummaryError(error);
            };

            switch (aiProvider) {
                case 'none':
                    this.showSummaryInPanel(formattedComment, true, 0, commentPathToIdMap).catch(error => {
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
                                title: 'Error',
                                metadata: '',
                                text: errorFragment
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
            title: 'Error',
            metadata: '',
            text: errorMessage
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
            title: 'LLM Provider Setup Required',
            metadata: '',
            text: message
        });

        const optionsLink = this.summaryPanel.panel.querySelector('#options-page-link');
        if (optionsLink) {
            optionsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openOptionsPage();
            });
        }
    }

    async showSummaryInPanel(summary, fromCache, duration, commentPathToIdMap = null) {
        const formattedSummary = createSummaryFragment(summary, commentPathToIdMap);

        const {aiProvider, model} = await getAIProviderModel();
        let subtitle = null;
        if (fromCache) {
            const durationText = duration || 'some time';
            subtitle = buildFragment([
                'Summary generated by ',
                createStrong('HNCompanion'),
                ' and cached ',
                createStrong(durationText),
                ' ago.',
                document.createElement('br'),
                createInternalLink('llm-summarize-link', 'Generate fresh summary'),
                ' using LLM ',
                createInternalLink('options-page-link', 'configured in settings'),
                '.'
            ]);
        } else if (aiProvider) {
            subtitle = buildFragment([
                'Summarized using ',
                createStrong(`${aiProvider}/${model || ''}`),
                ' in ',
                createStrong(`${duration || '0'} secs`),
                '.'
            ]);
        }

        this.summaryPanel.updateContent({
            metadata: subtitle,
            text: formattedSummary
        });

        const llmSummarizeLink = this.summaryPanel.panel.querySelector('#llm-summarize-link');
        if (llmSummarizeLink) {
            llmSummarizeLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.summarizeAllComments(true);
            });
        }

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
}

export default HNEnhancer;
