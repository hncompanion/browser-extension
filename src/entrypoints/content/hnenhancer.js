import HNState from './hnstate.js';
import SummaryPanel from './summary-panel.js';
import {browser} from "wxt/browser";
import {storage} from '#imports';
import {Logger} from "../../lib/utils.js";
import {sendBackgroundMessage} from "../../lib/messaging.js";
import {AI_SYSTEM_PROMPT, AI_USER_PROMPT_TEMPLATE} from './constants.js';
import {marked} from 'marked';
import {enforceSafeLinks, sanitizeHtmlToFragment} from '../../lib/sanitize.js';

marked.setOptions({
    headerIds: false,
    mangle: false
});

// TODO: Remove or move inside
const SummarizeCheckStatus = {
    OK: 'ok',
    TEXT_TOO_SHORT: 'too_short',
    THREAD_TOO_SHALLOW: 'too_shallow',
    THREAD_TOO_DEEP: 'chrome_depth_limit'
};

class HNEnhancer {

    static DEBUG = false;  // Set to true when debugging

    constructor() {

        if(HNEnhancer.DEBUG) {
            Logger.enableLoggingSync();
        }

        this.authorComments = this.createAuthorCommentsMap();    // Create a map of comment elements by author
        this.popup = this.createAuthorPopup();
        this.userInfoCache = new Map();                         // Cache for user info to avoid repeated API calls
        this.postAuthor = this.getPostAuthor();

        this.currentComment = null;         // Track currently focused comment

        // Navigation history for undo functionality
        this.navigationHistory = [];
        this.maxHistorySize = 10;

        this.helpModal = this.createHelpModal();

        this.createHelpIcon();

        // Initialize the page based on type - home page vs. comments page
        if (this.isHomePage) {

            this.currentPostIndex = -1;     // initialize to -1 to indicate that it is not set
            this.allPosts = null;

            this.initHomePageNavigation();

        } else if (this.isCommentsPage) {
            // Initialize custom navigation in Comments page - author comments, comment navigation and summary panel,
            this.initCommentsPageNavigation();

            // Set up click handlers for comment focus
            this.setupCommentClickHandlers();

            // Navigate to first comment, but don't scroll to it (to avoid jarring effect when you first come to the page)
            this.navigateToFirstComment(false);

            // this.initChromeBuiltinAI();

            this.summaryPanel = new SummaryPanel();
        }

        // set up all keyboard shortcuts - global and page-specific (Home pages vs. Comments page)
        this.setupKeyBoardShortcuts();
    }

    get isHomePage() {
        const pathname = window.location.pathname;
        return pathname === '/' || pathname === '/news' || pathname === '/newest' || pathname === '/ask' || pathname === '/show' || pathname === '/front' || pathname === '/shownew';
    }

    get isCommentsPage() {
        return window.location.pathname === '/item';
    }

    initHomePageNavigation() {
        this.allPosts = document.querySelectorAll('.athing');

        // check if there is a post id saved in the storage - if yes, restore it; else navigate to the first post
        HNState.getLastSeenPostId().then(lastSeenPostId => {

            let lastSeenPostIndex = -1;
            if (lastSeenPostId) {
                Logger.debugSync(`Got last seen post id from storage: ${lastSeenPostId}`);

                // Find the post with matching ID
                const posts = Array.from(this.allPosts);
                lastSeenPostIndex = posts.findIndex(post => this.getPostId(post) === lastSeenPostId);
            }

            // if we got a valid last seen post, set it as the current index, else go to the first post
            if (lastSeenPostIndex !== -1) {
                this.setCurrentPostIndex(lastSeenPostIndex);
            } else {
                this.navigateToPost('first');
            }
        });
    }

    getPostId(post) {
        // Extract post ID from the comments link
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
                if(this.allPosts.length > 0) {
                    this.setCurrentPostIndex(0);
                }
                break;
            case 'next':
                const nextPostIndex = this.currentPostIndex + 1;
                if(nextPostIndex < this.allPosts.length) {
                    this.setCurrentPostIndex(nextPostIndex);
                } else {
                    Logger.debugSync(`Currently at the last post, cannot navigate further to next post.`);
                }
                break;
            case 'prev':
                const prevPostIndex = this.currentPostIndex - 1;
                if(prevPostIndex >= 0) {
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
        if(this.currentPostIndex < 0 || this.currentPostIndex >= this.allPosts.length){
            Logger.infoSync(`No current post to return, because current post index is outside the bounds of the posts array. 
                            currentPostIndex: ${this.currentPostIndex}. allPosts.length: ${this.allPosts.length}`);
            return null;
        }

        return this.allPosts[this.currentPostIndex];
    }

    // sets the current post index and highlights the post at the given post index.
    //  Valid inputs: any number between 0 and the length of allPosts array
    setCurrentPostIndex(postIndex) {

        if(!this.allPosts) return;

        if(this.allPosts.length === 0) {
            Logger.debugSync(`No posts in this page, hence not setting the current post.`);
            return;
        }
        if(postIndex < 0 || postIndex >= this.allPosts.length) {
            Logger.infoSync(`ERROR: cannot set current post because the given index is outside the bounds of the posts array. 
                            postIndex: ${postIndex}. allPosts.length: ${this.allPosts.length}`);
            return;
        }

        // un-highlight the current post before updating the post index.
        if(this.currentPostIndex >= 0) {
            const prevPost = this.allPosts[this.currentPostIndex];
            prevPost.classList.remove('highlight-post')
        }

        // update the post index if there is a valid post at that index
        const newPost = this.allPosts[postIndex];
        if(!newPost) {
            Logger.infoSync(`Post at the new index is null. postIndex: ${postIndex}`);
            return;
        }

        this.currentPostIndex = postIndex;
        Logger.debugSync(`Updated current post index to ${postIndex}`);

        // save the id of the new post as the last seen post id in the storage
        const newPostId = this.getPostId(newPost);
        if(newPostId) {
            HNState.saveLastSeenPostId(newPostId);
            Logger.debugSync(`Saved current post id as last seen post id: ${newPostId}`);
        }

        // highlight the new post and scroll to it
        newPost.classList.add('highlight-post');
        newPost.scrollIntoView({behavior: 'smooth', block: 'center'});
    }

    initCommentsPageNavigation() {

        // Inject 'Summarize all comments' link at the top of the main post
        this.injectSummarizePostLink();

        // Go through all the comments in this post and inject all our nav elements - author, summarize etc.
        const allComments = document.querySelectorAll('.athing.comtr');

        allComments.forEach(comment => {

            // inject the author nav links - # of comments, left/right links to see comments by the same author
            this.injectAuthorCommentsNavLinks(comment);

            // customize the default next/prev/root/parent links to do the Companion behavior
            this.customizeDefaultNavLinks(comment);

            // Insert summarize thread link at the end
            this.injectSummarizeThreadLinks(comment);
        });

        // Set up the hover events on all user elements - in the main post subline and each comment
        this.setupUserHover();
    }

    injectAuthorCommentsNavLinks(comment) {
        const authorElement = comment.querySelector('.hnuser');
        if (authorElement && !authorElement.querySelector('.comment-count')) {
            const author = authorElement.textContent;
            const count = this.authorComments.get(author).length;

            const container = document.createElement('span');

            const countSpan = document.createElement('span');
            countSpan.className = 'comment-count';
            countSpan.textContent = `(${count})`;
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

            // Get the parent element of the author element and append the container as second child
            authorElement.parentElement.insertBefore(container, authorElement.parentElement.children[1]);
        }
    }

    injectSummarizeThreadLinks(comment) {
        const navsElement = comment.querySelector('.navs');
        if(!navsElement) {
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

            // Set the current comment and summarize the thread starting from this comment
            this.setCurrentComment(comment);

            await this.summarizeThread(comment);
        });

        navsElement.appendChild(summarizeThreadLink);
    }

    createAuthorCommentsMap() {
        const authorCommentsMap = new Map();

        // Get all comments in this post
        const comments = document.querySelectorAll('.athing.comtr');

        // Count comments by author and the author comments elements by author
        comments.forEach(comment => {

            // save the author comments mapping (comments from each user in this post)
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

    createHelpIcon() {
        const icon = document.createElement('div');
        icon.className = 'help-icon';
        icon.textContent = '?';
        icon.title = 'Keyboard Shortcuts (Press ? or / to toggle)';

        icon.onclick = () => this.toggleHelpModal(true);

        document.body.appendChild(icon);
        return icon;
    }

    toggleHelpModal(show) {
        this.helpModal.style.display = show ? 'flex' : 'none';
    }

    createAuthorPopup() {
        const popup = document.createElement('div');
        popup.className = 'author-popup';
        document.body.appendChild(popup);
        return popup;
    }

    buildFragment(parts) {
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

    createStrong(text) {
        const strong = document.createElement('strong');
        strong.textContent = text;
        return strong;
    }

    createHighlightedAuthor(author) {
        const span = document.createElement('span');
        span.className = 'highlight-author';
        span.textContent = author;
        return span;
    }

    createExternalLink(url, label) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = label;
        return link;
    }

    createInternalLink(id, label) {
        const link = document.createElement('a');
        link.href = '#';
        link.id = id;
        link.textContent = label;
        return link;
    }

    createCommentLink(commentId) {
        const link = document.createElement('a');
        link.href = '#';
        link.title = `Go to comment #${commentId}`;
        link.dataset.commentLink = 'true';
        link.dataset.commentId = commentId;
        link.className = 'summary-comment-link';
        link.textContent = `comment #${commentId}`;
        return link;
    }

    createLoadingMessage(parts) {
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

    getPostAuthor() {
        const postAuthorElement = document.querySelector('.fatitem .hnuser');
        return postAuthorElement ? postAuthorElement.textContent : null;
    }

    async fetchUserInfo(username) {
        // Check cache first
        if (this.userInfoCache.has(username)) {
            return this.userInfoCache.get(username);
        }

        try {
            const data = await sendBackgroundMessage(
                'FETCH_API_REQUEST',
                {
                    url: `https://hn.algolia.com/api/v1/users/${username}`,
                    method: 'GET',
                    timeout: 10000
                }
            );

            // Process the about text to make links clickable
            let about = data.about || 'No about information';

            // First decode HTML entities
            about = this.decodeHtmlEntities(about);

            // If the 'about info' contains HTML links, preserve them
            if (about.includes('<a href=')) {
                // No need to modify existing links
            } else {
                // Look for URLs in plain text and convert them to links
                about = about.replace(
                    /((https?:\/\/|www\.)[^\s<]+)/g,
                    (match, url) => {
                        // If URL starts with www., add https:// protocol
                        const href = url.startsWith('www.') ? `https://${url}` : url;
                        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
                    }
                );
            }

            const result = {
                karma: data.karma || 'Not found',
                about: about
            };

            // Cache the successful result
            this.userInfoCache.set(username, result);
            return result;
        } catch (error) {
            return {
                karma: 'User info error',
                about: 'No about information'
            };
        }
    }

    setupKeyBoardShortcuts() {

        // Shortcut keys specific to the Comments page
        const doubleKeyShortcuts = {
            'comments': {
                // Double key combinations
                'g+g': () => {
                    // Go to first comment
                    const currentTime = Date.now();
                    if (lastKey === 'g' && currentTime - lastKeyPressTime < 500) {
                        this.navigateToFirstComment();
                    }

                    // Update the last key and time so that we can handle the repeated press in the next iteration
                    lastKey = 'g';
                    lastKeyPressTime = currentTime;
                }
            },
            'home': {
                'g+g': () => {
                    // Go to first post
                    const currentTime = Date.now();
                    if (lastKey === 'g' && currentTime - lastKeyPressTime < 500) {
                        this.navigateToPost('first');
                    }

                    // Update tracking for next potential combination
                    lastKey = 'g';
                    lastKeyPressTime = currentTime;
                }
            }
        }

        // Shortcut keys specific to Home Page
        const homePageKeyboardShortcuts = this.getHomePageKeyboardShortcuts();

        // Shortcut keys specific to Comments page
        const commentsPageKeyboardShortcuts  = this.getCommentsPageKeyboardShortcuts();

        // Shortcut keys common to all pages (Comments, Home)
        const globalKeyboardShortcuts = this.getGlobalKeyboardShortcuts();

        // Track last key press
        let lastKey = null;
        let lastKeyPressTime = 0;
        const KEY_COMBO_TIMEOUT = 1000; // 1 second timeout for combinations

        document.addEventListener('keydown', (e) => {

            // Handle key press only when it is not in an input field and not Ctrl / Cmd keys.
            //  This will allow the default behavior when these keys are pressed
            const isInputField = e.target.matches('input, textarea, select, [contenteditable="true"]');
            if(isInputField || e.ctrlKey || e.metaKey) {
                return;
            }

            Logger.debugSync(`Pressed key: ${e.key}. Shift key: ${e.shiftKey}`);

            const currentTime = Date.now();
            let shortcutKey = e.key;

            // check if this is a shifted key (eg: '?'), if so, treat it as a single key
            const shiftedKeys = ['?'];
            const isShiftedKey = e.shiftKey && shiftedKeys.includes(e.key);

            if (!isShiftedKey) {
                // Check for key combination for non-shifted keys
                if (lastKey && (currentTime - lastKeyPressTime) < KEY_COMBO_TIMEOUT) {
                    shortcutKey = `${lastKey}+${shortcutKey}`;
                }
            }


            // Look for a handler for the given shortcut key in the key->handler mapping
            //  - first in the page-specific keys, then in the global shortcuts.
            const pageShortcuts = this.isHomePage ? {
                ...homePageKeyboardShortcuts,
                ...(doubleKeyShortcuts['home'] || {})
            } : this.isCommentsPage ? {
                ...commentsPageKeyboardShortcuts,
                ...(doubleKeyShortcuts['comments'] || {})
            } : {};

            // this.logDebug('Selected page shortcuts:', Object.keys(pageShortcuts));

            const shortcutHandler = pageShortcuts[shortcutKey] || globalKeyboardShortcuts[shortcutKey];

            Logger.debugSync(`Shortcut key: ${shortcutKey}. Handler found? ${!!shortcutHandler}`);

            // If we have a handler for this key or combination, invoke it
            if (shortcutHandler) {
                e.preventDefault();
                shortcutHandler();

                // Reset after successful combination
                lastKey = null;
                lastKeyPressTime = 0;
            } else {
                // Update tracking for potential combination
                lastKey = shortcutKey;
                lastKeyPressTime = currentTime;
            }
        });
    }

    getHomePageKeyboardShortcuts() {
        return {
            'j': () => {
                // Next post
                this.navigateToPost('next');
            },
            'k': () => {
                // Previous post
                this.navigateToPost('prev');
            },
            'o': () => {
                // Open post in new tab
                const currentPost = this.getCurrentPost();
                if(!currentPost) return;

                const postLink = currentPost.querySelector('.titleline a');
                if (postLink) {
                    window.open(postLink.href, '_blank');
                }
            },
            'Shift+C': () => {
                // Open comments page in new tab
                const currentPost = this.getCurrentPost();
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
                // Open comments page
                const currentPost = this.getCurrentPost();
                if(!currentPost) return;

                if (currentPost.nextElementSibling) {
                    const subtext = currentPost.nextElementSibling;
                    const commentsLink = subtext.querySelector('a[href^="item?id="]');
                    if (commentsLink) {
                        window.location.href = commentsLink.href;
                    }
                }
            }
        }
    }

    getCommentsPageKeyboardShortcuts() {
        return {
            'j': () => {
                // Next comment at same depth
                // Find the 'next' hyperlink in the HN nav panel and set that as the current comment.
                const nextComment = this.getNavElementByName(this.currentComment, 'next');
                if (nextComment) {
                    this.setCurrentComment(nextComment);
                }
            },
            'k': () => {
                // Previous comment at same depth (same as 'prev' hyperlink)
                // Find the 'prev' hyperlink in the HN nav panel and set that as the current comment.
                const prevComment = this.getNavElementByName(this.currentComment, 'prev');
                if (prevComment) {
                    this.setCurrentComment(prevComment);
                } else {
                    this.navigateToChildComment(false);
                }
            },
            'l': () => {
                // Navigate to next comment without hierarchy
                this.navigateToChildComment();
            },
            'h': () => {
                // Navigate to previous comment without hierarchy
                this.navigateToChildComment(false);
            },
            'r': () => {
                // Find the 'root' hyperlink in the HN nav panel and set that as the current comment.
                const rootComment = this.getNavElementByName(this.currentComment, 'root');
                if (rootComment) {
                    this.setCurrentComment(rootComment);
                }
            },
            '[': () => {
                //  Previous comment by the same author
                const authorElement = this.currentComment.querySelector('.hnuser');
                if (authorElement) {
                    const author = authorElement.textContent;
                    this.navigateAuthorComments(author, this.currentComment, 'prev');
                }
            },
            ']': () => {
                // Next comment by the same author
                const authorElement = this.currentComment.querySelector('.hnuser');
                if (authorElement) {
                    const author = authorElement.textContent;
                    this.navigateAuthorComments(author, this.currentComment, 'next');
                }
            },
            'z': () => {
                // Scroll to current comment
                if (this.currentComment) {
                    this.currentComment.scrollIntoView({behavior: 'smooth', block: 'center'});
                }
            },
            'c': () => {
                // Collapse/expand current comment
                if (this.currentComment) {
                    const toggleLink = this.currentComment.querySelector('.togg');
                    if (toggleLink) {
                        toggleLink.click();
                    }
                }
            },
            'o': () => {
                // Open the original post in new tab
                const postLink = document.querySelector('.titleline a');
                if (postLink) {
                    window.open(postLink.href, '_blank');
                }
            },
            's': () => {
                // Open/close the summary panel on the right
                this.summaryPanel.toggle();

            },
            'u': () => {
                // Undo navigation - go back to previous comment focus position
                this.undoNavigation();
            },
        }
    }

    getGlobalKeyboardShortcuts() {
        return {
            '?': () => {
                // Open/close the help modal
                this.toggleHelpModal(this.helpModal.style.display === 'none');
            },
            '/': () => {
                // Open/close the help modal
                this.toggleHelpModal(this.helpModal.style.display === 'none');
            },
            'Escape': () => {
                // Close the help modal if it is open
                if (this.helpModal.style.display !== 'none') {
                    this.toggleHelpModal(false);
                }
            },
        }
    }

    navigateToFirstComment(scrollToComment = true) {
        const firstComment = document.querySelector('.athing.comtr');
        if (firstComment) {
            this.setCurrentComment(firstComment, scrollToComment);
        }
    }

    navigateToChildComment(forward = true) {
        if (!this.currentComment) return;

        // The comments are arranged as a flat array of table rows where the hierarchy is represented by the depth of the element.
        // Direction determines whether to look for the next or previous comment.
        let sibling = forward ? this.currentComment.nextElementSibling : this.currentComment.previousElementSibling;

        while (sibling) {
            // Look for the element with the style classes of comment. If found, return. If not, continue to the next/previous sibling.
            if (sibling.classList.contains('athing') && sibling.classList.contains('comtr')) {
                // Check if this comment is hidden, if so, skip it
                if (sibling.classList.contains('noshow')) {
                    sibling = forward ? sibling.nextElementSibling : sibling.previousElementSibling;
                    continue;
                }
                this.setCurrentComment(sibling);
                return; // Found the child comment
            }
            sibling = forward ? sibling.nextElementSibling : sibling.previousElementSibling;
        }
    }

    getNavElementByName(comment, elementName) {
        if (!comment) return;

        // Get HN's default navigation panel and locate the nav element by the given name ('root', 'parent', 'next' or 'prev').
        const hyperLinks = comment.querySelectorAll('.comhead .navs a');
        if (hyperLinks) {
            // Find the <a href> with text that matches the given name
            const hyperLink = Array.from(hyperLinks).find(a => a.textContent.trim() === elementName);
            if (hyperLink) {
                const commentId = hyperLink.hash.split('#')[1];
                return document.getElementById(commentId);
            }
        }
    }

    setCurrentComment(comment, scrollIntoView = true, saveNavigationState = true) {
        if (!comment) return;

        // Save current position to history before changing focus (only if requested)
        if (this.currentComment && saveNavigationState) {
            this.saveNavigationState(this.currentComment);
        }

        // Un-highlight the current comment's author before updating the current comment.
        //  Note: when this method is called the first time, this.currentComment will be null and it is ok.
        if(this.currentComment) {
            const prevAuthorElement = this.currentComment.querySelector('.hnuser');
            if (prevAuthorElement) {
                prevAuthorElement.classList.remove('highlight-author');
            }
        }

        // update the current comment
        this.currentComment = comment;

        // Highlight the new comment's author
        const newAuthorElement = comment.querySelector('.hnuser');
        if (newAuthorElement) {
            newAuthorElement.classList.add('highlight-author');
        }

        // Scroll to the new comment element if asked for. Scroll to the center of the page instead of the top
        //   so that we can see a little bit of the previous comments.
        if (scrollIntoView) {
            comment.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }

    createSummaryFragment(markdown, commentPathToIdMap) {
        let html;
        try {
            html = marked.parse(markdown || '');
        } catch (e) {
            Logger.error('Failed to parse markdown, displaying raw text:', e);
            const fragment = document.createDocumentFragment();
            const pre = document.createElement('pre');
            pre.textContent = markdown || '';
            fragment.appendChild(pre);
            return fragment;
        }
        const fragment = sanitizeHtmlToFragment(html);
        this.replaceCommentBacklinks(fragment, commentPathToIdMap);
        enforceSafeLinks(fragment);
        return fragment;
    }

    replaceCommentBacklinks(fragment, commentPathToIdMap) {
        if (!fragment) return;

        fragment.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            const match = href.match(/^https?:\/\/news\.ycombinator\.com\/item\?id=\d+#(\d+)/);
            if (!match) return;
            const commentId = match[1];
            link.replaceWith(this.createCommentLink(commentId));
        });

        const textNodes = [];
        const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        const pathRegex = /\[(\d+(?:\.\d+)*)]/g;
        textNodes.forEach(node => {
            const text = node.nodeValue;
            if (!text) return;

            if (!pathRegex.test(text)) {
                pathRegex.lastIndex = 0;
                return;
            }

            pathRegex.lastIndex = 0;
            const replacement = document.createDocumentFragment();
            let lastIndex = 0;
            let match;
            while ((match = pathRegex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    replacement.append(text.slice(lastIndex, match.index));
                }
                const path = match[1];
                const commentId = commentPathToIdMap?.get(path);
                if (commentId) {
                    replacement.appendChild(this.createCommentLink(commentId));
                } else {
                    replacement.append(match[0]);
                }
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < text.length) {
                replacement.append(text.slice(lastIndex));
            }
            node.replaceWith(replacement);
        });
    }

    decodeHtmlEntities(text) {
        // Use browser's built-in HTML parsing to decode all entities
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    createHelpModal() {
        const modal = document.createElement('div');
        modal.className = 'keyboard-help-modal';
        modal.style.display = 'none';

        const content = document.createElement('div');
        content.className = 'keyboard-help-content';

        const title = document.createElement('h2');
        title.textContent = 'HN Companion: Keyboard Shortcuts';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'help-close-btn';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => this.toggleHelpModal(false);

        const shortcutGroups = {
            "global": {
                title: 'Global',
                shortcuts: [
                    {key: 'o', description: 'Open post in new window'},
                    {key: '? /', description: 'Toggle this help panel'},
                    {key: 'gg', description: 'First Story/comment'}
                ]
            },
            "home": {
                title: 'Home Pages (Home, New, Past, Ask, Show)',
                shortcuts: [
                    {key: 'j k', description: 'Next/previous post'},
                    {key: 'c', description: 'Open comments page. Hold Shift to open in new tab'},
                ]
            },
            "comments": {
                title: 'Post Details Page',
                shortcuts: [
                    {key: 'j k', description: 'Next/previous comment at same depth'},
                    {key: 'l h', description: 'Next/previous comment without hierarchy'},
                    {key: '[ ]', description: 'Prev/next comment by author'},
                    {key: 'u', description: 'Undo navigation (go back)'},
                    {key: 's', description: 'Toggle summary panel'},
                    {key: 'r', description: 'Go to root comment'},
                    {key: 'z', description: 'Scroll to current'},
                    {key: 'c', description: 'Collapse/expand comment'}
                ]
            }
        };

        const table = document.createElement('table');

        for (const groupKey in shortcutGroups) {
            const group = shortcutGroups[groupKey];  // Get the actual group object

            const headerRow = table.insertRow();
            const headerCell = headerRow.insertCell();
            headerCell.colSpan = 2;  // Span both columns
            headerRow.className = 'group-header';

            const subHeading = document.createElement('h3');
            subHeading.textContent = group.title;
            headerCell.appendChild(subHeading);

            group.shortcuts.forEach(shortcut => {
                const shortcutRow = table.insertRow();

                const keyCell = shortcutRow.insertCell();

                // Keys could be 'l', 'h' for single keys, 'gg' for repeated keys or '?|/' for multiple keys
                const keys = shortcut.key.split(' ');
                keys.forEach((k, index) => {
                    const keySpan = document.createElement('span');
                    keySpan.className = 'key';
                    keySpan.textContent = k;
                    keyCell.appendChild(keySpan);

                    if (index < keys.length - 1) {
                        const separator = document.createElement('span');
                        separator.textContent = ' or ';
                        keyCell.appendChild(separator);
                    }
                });

                const descCell = shortcutRow.insertCell();
                descCell.textContent = shortcut.description;
            });
        }

        content.appendChild(closeBtn);
        content.appendChild(title);
        
        // Create scrollable body wrapper
        const body = document.createElement('div');
        body.className = 'keyboard-help-body';
        body.appendChild(table);
        content.appendChild(body);

        const footer = document.createElement('div');
        footer.className = 'keyboard-help-footer';
        footer.append('Learn more about features and updates on our ');
        const footerLink = document.createElement('a');
        footerLink.href = 'https://github.com/hncompanion/browser-extension/';
        footerLink.target = '_blank';
        footerLink.rel = 'noopener noreferrer';
        footerLink.textContent = 'GitHub page';
        footer.appendChild(footerLink);
        footer.append(' ↗️');
        content.appendChild(footer);

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target === modal) {
                this.toggleHelpModal(false);
            }
        });

        return modal;
    }

    async summarizeThread(comment) {

        // Get the item id from the 'age' link that shows '10 hours ago' or similar
        const itemLinkElement = comment.querySelector('.age')?.getElementsByTagName('a')[0];
        if (!itemLinkElement) {
            await Logger.error('Could not find the item link element to get the item id for summarization');
            return;
        }

        // get the content of the thread
        const itemId = itemLinkElement.href.split('=')[1];
        const threadData = await this.getHNThread(itemId);
        if (!threadData || !threadData.formattedComment) {
            await Logger.error(`Could not get the thread for summarization. item id: ${itemId}`);
            return;
        }
        const {formattedComment, commentPathToIdMap} = threadData;

        const commentDepth = commentPathToIdMap.size;
        const {aiProvider, model} = await this.getAIProviderModel();

        if (!aiProvider) {
            await Logger.info('AI provider not configured. Prompting user to complete setup.');
            this.showConfigureAIMessage();
            return;
        }

        const authorElement = comment.querySelector('.hnuser');
        const author = authorElement.textContent || '';

        const summarizeCheckResult = this.shouldSummarizeText(formattedComment, commentDepth, aiProvider);

        if (summarizeCheckResult.status !== SummarizeCheckStatus.OK) {
            const metadataTemplates = {
                [SummarizeCheckStatus.TEXT_TOO_SHORT]: this.buildFragment([
                    'Thread too brief to use the selected cloud AI ',
                    this.createStrong(aiProvider)
                ]),
                [SummarizeCheckStatus.THREAD_TOO_SHALLOW]: this.buildFragment([
                    'Thread not deep enough to use the selected cloud AI ',
                    this.createStrong(aiProvider)
                ]),
                [SummarizeCheckStatus.THREAD_TOO_DEEP]: this.buildFragment([
                    'Thread too deep for the selected AI ',
                    this.createStrong(aiProvider)
                ])
            };

            const createThreadTooDeepMessage = () => this.buildFragment([
                'This ',
                this.createHighlightedAuthor(author),
                ' thread is too long or deeply nested to be handled by Chrome Built-in AI. The underlying model Gemini Nano may struggle and hallucinate with large content and deep nested threads due to model size limitations. This model works best with individual comments or brief discussion threads.',
                document.createElement('br'),
                document.createElement('br'),
                'However, if you still want to summarize this thread, you can ',
                this.createInternalLink('options-page-link', 'configure another AI provider'),
                ' like local ',
                this.createExternalLink('https://ollama.com/', 'Ollama'),
                ' or cloud AI services like OpenAI or Claude.'
            ]);

            const createThreadTooShortMessage = () => this.buildFragment([
                'This ',
                this.createHighlightedAuthor(author),
                ' thread is concise enough to read directly. Summarizing short threads with a cloud AI service would be inefficient.',
                document.createElement('br'),
                document.createElement('br'),
                'However, if you still want to summarize this thread, you can ',
                this.createInternalLink('options-page-link', 'configure a local AI provider'),
                ' like ',
                this.createExternalLink('https://developer.chrome.com/docs/ai/built-in', 'Chrome Built-in AI'),
                ' or ',
                this.createExternalLink('https://ollama.com/', 'Ollama'),
                ' for more efficient processing of shorter threads.'
            ]);

            this.summaryPanel.updateContent({
                title: 'Summarization not recommended',
                metadata: metadataTemplates[summarizeCheckResult.status],
                text: summarizeCheckResult.status === SummarizeCheckStatus.THREAD_TOO_DEEP
                    ? createThreadTooDeepMessage()
                    : createThreadTooShortMessage()
            });

            // Once the error message is rendered in the summary panel, add the click handler for the Options page link
            const optionsLink = this.summaryPanel.panel.querySelector('#options-page-link');
            if (optionsLink) {
                optionsLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openOptionsPage();
                });
            }
            return;
        }

        // Show an in-progress text in the summary panel
        const metadata = this.buildFragment([
            'Analyzing discussion in ',
            this.createHighlightedAuthor(author),
            ' thread'
        ]);
        const loadingParts = ['Generating summary'];
        if (aiProvider) {
            loadingParts.push(' using ', this.createStrong(`${aiProvider}/${model || ''}`));
        }
        loadingParts.push('... This may take a few moments.');

        this.summaryPanel.updateContent({
            title: 'Thread Summary',
            metadata: metadata,
            text: this.createLoadingMessage(loadingParts)
        });

        await this.summarizeText(formattedComment, commentPathToIdMap);
    }

    shouldSummarizeText(formattedText, commentDepth, aiProvider) {
        // Ollama can handle all kinds of data - large, small, deep threads. So return true
        if (aiProvider === 'ollama') {
            return { status: SummarizeCheckStatus.OK };
        }

        // OpenAI and Claude can handle larger data, but they are expensive, so there should be a minimum length and depth
        const minSentenceLength = 8;
        const minCommentDepth = 3;
        const sentences = formattedText.split(/[.!?]+(?:\s+|$)/)
            .filter(sentence => sentence.trim().length > 0);

        if (sentences.length <= minSentenceLength) {
            return { status: SummarizeCheckStatus.TEXT_TOO_SHORT };
        }
        if (commentDepth <= minCommentDepth) {
            return { status: SummarizeCheckStatus.THREAD_TOO_SHALLOW };
        }

        return { status: SummarizeCheckStatus.OK };
    }

    // Customize the default HN navigation such that it is synchronized with our navigation.
    //  When the user clicks next / prev / root / parent links, the new comment should be highlighted.
    customizeDefaultNavLinks(comment) {
        const hyperLinks = comment.querySelectorAll('.comhead .navs a');
        if (!hyperLinks) return;

        // Find the <a href> with text that have a hash ('#<comment_id>') and add click event listener
        const navLinks = Array.from(hyperLinks).filter(link => link.hash.length > 0);

        navLinks.forEach(link => {
            link.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); // stop the default link navigation

                const targetComment = this.getNavElementByName(comment, link.textContent.trim());
                if (targetComment) {
                    this.setCurrentComment(targetComment);
                }
            };
        });
    }

    navigateAuthorComments(author, currentComment, direction) {
        const comments = this.authorComments.get(author);
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

    setupUserHover() {
        let hoverTimeout = null;

        document.querySelectorAll('.hnuser').forEach(authorElement => {
            authorElement.addEventListener('mouseenter', (e) => {
                const target = e.target;

                // Clear any pending hover timeout
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                }

                // Debounce: wait 200ms before fetching user info
                hoverTimeout = setTimeout(async () => {
                    const username = target.textContent.replace(/[^a-zA-Z0-9_-]/g, '');
                    const userInfo = await this.fetchUserInfo(username);

                    if (userInfo) {
                        this.popup.replaceChildren();

                        const name = document.createElement('strong');
                        name.textContent = username;
                        this.popup.appendChild(name);
                        this.popup.appendChild(document.createElement('br'));

                        this.popup.append(`Karma: ${userInfo.karma}`);
                        this.popup.appendChild(document.createElement('br'));

                        const aboutLabel = document.createElement('div');
                        aboutLabel.textContent = 'About:';
                        this.popup.appendChild(aboutLabel);

                        const aboutContent = document.createElement('div');
                        const aboutFragment = sanitizeHtmlToFragment(userInfo.about || '');
                        enforceSafeLinks(aboutFragment);
                        aboutContent.appendChild(aboutFragment);
                        this.popup.appendChild(aboutContent);

                        const rect = target.getBoundingClientRect();
                        this.popup.style.left = `${rect.left}px`;
                        this.popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
                        this.popup.style.display = 'block';

                        // Track whether mouse is over user element or popup
                        this.isMouseOverUserOrPopup = true;
                    }
                }, 200);
            });

            authorElement.addEventListener('mouseleave', () => {
                // Clear pending hover timeout to cancel fetch if mouse left quickly
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }

                // Don't hide immediately - wait to check if mouse moved to popup
                setTimeout(() => {
                    if (!this.isMouseOverUserOrPopup) {
                        this.popup.style.display = 'none';
                    }
                }, 100);
                this.isMouseOverUserOrPopup = false;
            });
        });

        // Add mouse enter/leave events for the popup itself
        this.popup.addEventListener('mouseenter', () => {
            this.isMouseOverUserOrPopup = true;
        });

        this.popup.addEventListener('mouseleave', () => {
            this.isMouseOverUserOrPopup = false;
            this.popup.style.display = 'none';
        });

        // Add global event listeners to close the user popup on Esc key or click outside the user element or popup

        // Add event listener for Esc key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.popup.style.display = 'none';
            }
        });

        // Add event listener for clicks outside the popup
        document.addEventListener('click', (e) => {
            if (!this.popup.contains(e.target) && !e.target.classList.contains('hnuser')) {
                this.popup.style.display = 'none';
            }
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

    async serverCacheConfigEnabled() {
        const settings = await storage.getItem('sync:settings');
        return settings?.serverCacheEnabled;
    }

    async getAIProviderModel() {
        const settings = await storage.getItem('sync:settings')
        const aiProvider = settings?.providerSelection;
        const model = settings?.[aiProvider]?.model;
        return {aiProvider, model};
    }

    async summarizeAllComments(skipCache = false) {
        const itemId = this.getCurrentHNItemId();
        if (!itemId) {
            await Logger.error(`Could not get item id of the current port to summarize all comments in it.`);
            return;
        }

        if (!this.summaryPanel.isVisible) {
            this.summaryPanel.toggle();
        }

        // Check if the user has configured the cached summary to be used. If yes, look for the summary in the cache.
        // Otherwise, fetch the summary from the LLM API
        const cacheConfigEnabled = await this.serverCacheConfigEnabled();
        if(cacheConfigEnabled && !skipCache) {
            this.summaryPanel.updateContent({
                title: 'Post Summary',
                metadata: 'Analyzing all threads in this post...',
                text: this.createLoadingMessage([
                    'Looking for cached summary on HNCompanion server...'
                ])
            });

            // Check if the summary is available in the cache and load it
            const cacheResult = await this.getCachedSummary(itemId);
            const cachedSummary = cacheResult?.summary;
            if (cachedSummary && cachedSummary.length > 0) {
                await Logger.info(`Using cached summary from HNCompanion server for post ${itemId}`);

                // Calculate how long ago the summary was generated.
                const timeAgo = this.getTimeAgo(cacheResult.created_at);

                // Show the cached summary in the summary panel.
                // Cached summaries already have links resolved, so we don't need to pass commentPathToIdMap
                // Parameters: (summary, isCached=true, timeAgo, commentPathToIdMap=null)
                await this.showSummaryInPanel(cachedSummary, true, timeAgo, null);

                // Once the summary is shown, we can return immediately.
                return;
            }
            // If the summary is not available in the cache, fetch the comments from the API and summarize them
            await Logger.info(`No cached summary found for post ID ${itemId}. Generating fresh summary using configured AI provider`);
        }
        try {

            const {aiProvider, model} = await this.getAIProviderModel();

            // Soon after installing the extension, the settings may not be available. Show a message to configure the AI provider.
            if(!aiProvider) {
                await Logger.info('AI provider not configured. Prompting user to complete setup.');
                this.showConfigureAIMessage();
                return;
            }

            // Show a meaningful in-progress message before starting the summarization
            const loadingParts = ['Generating summary'];
            if (aiProvider) {
                loadingParts.push(' using ', this.createStrong(`${aiProvider}/${model || ''}`));
            }
            loadingParts.push('... This may take a few moments. ');
            this.summaryPanel.updateContent({
                title: 'Post Summary',
                metadata: `Analyzing all threads in this post...`,
                text: this.createLoadingMessage(loadingParts)
            });

            const threadData = await this.getHNThread(itemId);
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

    getCurrentHNItemId() {
        return new URLSearchParams(window.location.search).get('id');
    }

    getTimeAgo(dateString) {
        try {
            // Incoming date is in UTC timezone, we much convert it to local timezone before we calculate the difference
            // The date format is "YYYY-MM-DD HH:mm:ss" and we need to convert it to a local date
            //  by adding 'T' and 'Z' to make it ISO format. We will also handle the case where the date string is already in ISO format.
            let localDate;

            // Check if the string already has 'T' and 'Z' (ISO format)
            if (dateString.includes('T') && dateString.endsWith('Z')) {
                localDate = new Date(dateString);
            } else {
                // Convert server format "YYYY-MM-DD HH:mm:ss" to ISO format
                const isoString = dateString.replace(' ', 'T') + 'Z';
                localDate = new Date(isoString);
            }

            // Check if the date is valid
            if (isNaN(localDate.getTime())) {
                Logger.errorSync(`Error parsing date. dateString: ${dateString}. localDate: ${localDate}`);
                return null;
            }

            const now = new Date();

            // Calculate difference in milliseconds
            const diffMs = now - localDate;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            // Format the output
            if (diffMinutes < 60) {
                return `${diffMinutes} min`;
            } else if (diffHours < 24) {
                return `${diffHours} hr${diffHours === 1 ? '' : 's'}`;
            } else {
                return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
            }
        } catch (error) {
            Logger.errorSync(`Error parsing date. dateString: ${dateString}. Error: ${error}`);
            return null;
        }
    }

    async getCachedSummary(postId) {
        // Look for the summary in the HNCompanion cache
        const url = `https://app.hncompanion.com/api/posts/${postId}`;
        try {
            //Send a message to the background script to fetch the summary from the server.
            //  If the summary is not available, the server will return a 404 error, which is expected.
            //  So we must handle the error gracefully by telling the background script that this is an expected error.
            //  The background script will not throw an error if the status is 404.
            const data = await sendBackgroundMessage(
                'FETCH_API_REQUEST',
                {
                    url, is404Expected: true // Tell the background script this 404 is expected
                }
            );

            // Handle the 404 error gracefully and return null
            if (data.status === 404) {
                await Logger.debug(`Cache miss: Post ${postId} not found in HNCompanion server. This is expected.`);
                return null;
            }

            if (!data || !data.summary) {
                await Logger.debug(`Cache miss: Post ${postId} returned invalid data from HNCompanion server. data is empty or summary is missing. data: ${JSON.stringify(data)}`);
                return null;
            }

            await Logger.debug(`Cache hit: Found summary for post ${postId} in HNCompanion server. Cache created at ${data.created_at} (UTC time)`);
            return data;
        } catch (error) {
            // Handle the error gracefully. Cache not available is not an error, just an info for the client to call LLM API
            await Logger.debug(`Failed to retrieve cache for post ${postId}: ${error.message}`);
            return null;
        }
    }

    async fetchHNCommentsFromAPI(itemId) {
        return await sendBackgroundMessage(
            'FETCH_API_REQUEST',
            {
                url: `https://hn.algolia.com/api/v1/items/${itemId}`,
                method: 'GET'
            }
        );
    }

    async getHNThread(itemId) {
        try {
            // Here, we will get the post with the itemId, parse the comments and enhance it with a better structure and score
            //  Get the comments from the HN API as well as the DOM.
            //  API comments are in JSON format structured as a tree and represents the hierarchy of comments.
            //  DOM comments (comments in the HTML page) are in the right sequence according to the up votes.

            const commentsJson = await this.fetchHNCommentsFromAPI(itemId);
            const commentsInDOM = this.getCommentsFromDOM();

            // Merge the two data sets to structure the comments based on hierarchy, votes and position
            const enhancedComments = this.enrichPostComments(commentsJson, commentsInDOM);

            // Create the path-to-id mapping in order to backlink the comments to the main page.
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
            // this.logDebug('commentPathToIdMap...', JSON.stringify([...commentPathToIdMap.entries()]));

            return {
                formattedComment,
                commentPathToIdMap
            };
        } catch (error) {
            await Logger.error(`Error in getHNThread: ${error.message}`);
            return null;
        }
    }

    getCommentsFromDOM() {

        // Comments in the DOM are arranged according to their up votes. This gives us the position of the comment.
        //  We will also extract the downvotes and text of the comment (after sanitizing it).
        // Create a map to store comment positions, downvotes and the comment text.
        const commentsInDOM = new Map();

        // Step 1: collect all comments and their metadata
        const commentRows = document.querySelectorAll('.comtr');
        Logger.debugSync(`Found ${commentRows.length} DOM comments in post`);

        let skippedComments = 0;
        commentRows.forEach((commentRow, index) => {

            // if comment is flagged, it will have the class "coll" (collapsed) or "noshow" (children of collapsed comments)
            // if the commText class is not found, the comment is deleted or not visible.
            // Check for these two conditions and skip it.
            const commentFlagged = commentRow.classList.contains('coll') || commentRow.classList.contains('noshow');
            const commentTextDiv = commentRow.querySelector('.commtext');
            if( commentFlagged || !commentTextDiv ) {
                skippedComments++;
                return;
            }

            // Step 2: Sanitize the comment text (remove unnecessary html tags, encodings)
            function sanitizeCommentText() {

                // Clone the comment div so that we don't modify the DOM of the main page
                const tempDiv = commentTextDiv.cloneNode(true);

                // Remove unwanted HTML elements from the clone
                [...tempDiv.querySelectorAll('a, code, pre')].forEach(element => element.remove());

                // Replace <p> tags with their text content
                tempDiv.querySelectorAll('p').forEach(p => {
                    const text = p.textContent;
                    p.replaceWith(text);
                });

                // Remove unnecessary new lines after extracting text content
                return (tempDiv.textContent || '').replace(/\n+/g, ' ');
            }
            const commentText = sanitizeCommentText();

            // Step 3: Get the down votes of the comment in order to calculate the score later
            // Downvotes are represented by the color of the text. The color is a class name like 'c5a', 'c73', etc.
            function getDownvoteCount(commentTextDiv) {

                // Downvotes are represented by the color of the text. The color is a class name like 'c5a', 'c73', etc.
                const downvotePattern = /c[0-9a-f]{2}/;

                // Find the first class that matches the downvote pattern
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

            // Step 4: Add the position, text and downvotes of the comment to the map
            commentsInDOM.set(Number(commentId), {
                position: index,
                text: commentText,
                downvotes: downvotes,
            });

        });

        Logger.debugSync(`...Comments from DOM:: Total: ${commentRows.length}. Skipped (flagged): ${skippedComments}. Remaining: ${commentsInDOM.size}`);

        return commentsInDOM;
    }

    enrichPostComments(commentsTree, commentsInDOM) {

        // Here, we enrich the comments as follows:
        //  add the position of the comment in the DOM (according to the up votes)
        //  add the text and the down votes of the comment (also from the DOM)
        //  add the author and number of children as replies (from the comment tree)
        //  sort them based on the position in the DOM (according to the up votes)
        //  add the path of the comment (1.1, 1.2, 2.1 etc.) based on the position in the DOM
        //  add the score of the comment based on the position and down votes

        // Step 1: Flatten the comment tree to map with metadata, position and parent relationship
        //  This is a recursive function that traverses the comment tree and adds the metadata to the map
        let flatComments = new Map();

        let apiComments = 0;
        let skippedComments = 0;
        function flattenCommentTree(comment, parentId) {

            // Track the number of comments as we traverse the tree to find the comments from HN API.
            apiComments++;

            // If this is the story item (root of the tree), flatten its children, but do not add the story item to the map.
            //  We must call flattenCommentTree with the parent id as null so that the 'path' for the top level comments is correct.
            if (comment.type === 'story') {
                if (comment.children && comment.children.length > 0) {
                    comment.children.forEach(child => {
                        flattenCommentTree(child, null);
                    });
                }
                return;
            }

            // Set the values into the flat comments map - some properties come from the comment, some from the DOM comments map
            //  - id, author, replies: from the comment
            //  - position, text, down votes: from the DOM comments map
            //  - parentId from the caller of this method

            // Get the DOM comment corresponding to this comment from the commentsInDOM map
            const commentInDOM = commentsInDOM.get(comment.id);
            if(!commentInDOM) {
                // This comment is not found in the DOM comments because it was flagged or collapsed, skip it
                skippedComments++;
                return;
            }

            // Add comment to map along with its metadata including position, downvotes and parentId that are needed for scoring.
            flatComments.set(comment.id, {
                id: comment.id,  // Add the id in the comment object so that you can access later
                author: comment.author,
                replies: comment.children?.length || 0,
                position: commentInDOM.position,
                text: commentInDOM.text,
                downvotes: commentInDOM.downvotes,
                parentId: parentId,
            });

            // Process children of the current comment, pass the comment id as the parent id to the next iteration
            //  so that the parent-child relationship is retained, and we can use it to calculate the path later.
            if (comment.children && comment.children.length > 0) {
                comment.children.forEach(child => {
                    flattenCommentTree(child, comment.id);
                });
            }
        }

        // Flatten the comment tree and collect comments as a map
        flattenCommentTree(commentsTree, null);

        // Log the comments so far, skip the top level comment (story) because it is not added to the map
        Logger.debugSync(`...Comments from API:: Total: ${apiComments - 1}. Skipped: ${skippedComments}. Remaining: ${flatComments.size}`);

        // Step 2: Start building the map of enriched comments, start with the flat comments and sorting them by position.
        //  We have to do this BEFORE calculating the path because the path is based on the position of the comments.
        const enrichedComments = new Map([...flatComments.entries()]
            .sort((a, b) => a[1].position - b[1].position));

        // Step 3: Calculate paths (1.1, 2.3 etc.) using the parentId and the sequence of comments
        //  This step must be done AFTER sorting the comments by position because the path is based on the position of the comments.
        let topLevelCounter = 1;

        function calculatePath(comment) {
            let path;

            if (!comment.parentId) {
                // Top level comment - its parent is the story ('summarize all comments' flow) OR this is the root comment ('summarize thread' flow).
                //  The path is just a number like 1, 2, 3, etc.
                path = String(topLevelCounter++);
            } else {
                // Child comment at any level.
                //  The path is the parent's path + the position of the comment in the parent's children list.
                const parent = enrichedComments.get(comment.parentId);

                // If parent was skipped (flagged/collapsed), treat this comment as top-level
                if (!parent || !parent.path) {
                    path = String(topLevelCounter++);
                } else {
                    const parentPath = parent.path;

                    // get all the children of this comment's parents - this is the list of siblings
                    const siblings = [...enrichedComments.values()]
                        .filter(c => c.parentId === comment.parentId);

                    // Find the position of this comment in the siblings list - this is the sequence number in the path
                    const positionInParent = siblings
                        .findIndex(c => c.id === comment.id) + 1;

                    // Set the path as the parent's path + the position in the parent's children list
                    path = `${parentPath}.${positionInParent}`;
                }
            }
            return path;
        }

        // Step 4: Calculate the score for each comment based on its position and downvotes
        function calculateScore(comment, totalCommentCount) {
            // Example score calculation using downvotes
            const downvotes = comment.downvotes || 0;

            // Score is a number between 1000 and 0, and is calculated as follows:
            //   default_score = 1000 - (comment_position * 1000 / total_comment_count)
            //   penalty for down votes = default_score * # of downvotes

            const MAX_SCORE = 1000;
            const MAX_DOWNVOTES = 10;

            const defaultScore = Math.floor(MAX_SCORE - (comment.position * MAX_SCORE / totalCommentCount));
            const penaltyPerDownvote = defaultScore / MAX_DOWNVOTES;
            const penalty = penaltyPerDownvote * downvotes;

            return Math.floor(Math.max(defaultScore - penalty, 0));
        }

        // Final step: Add the path and score for each comment as calculated above
        enrichedComments.forEach(comment => {
            comment.path = calculatePath(comment);
            comment.score = calculateScore(comment, enrichedComments.size);
        });

        return enrichedComments;
    }

    openOptionsPage() {
        browser.runtime.sendMessage({
            type: 'HN_SHOW_OPTIONS',
            data: {}
        }).catch(error => {
            Logger.errorSync('Error sending message to show options:', error);
        });
    }

    showConfigureAIMessage() {
        const message = this.buildFragment([
            'To use the summarization feature, you need to configure an AI provider.',
            document.createElement('br'),
            document.createElement('br'),
            this.createInternalLink('options-page-link', 'Open settings page'),
            ' to select your preferred LLM provider and configure your API key.'
        ]);

        this.summaryPanel.updateContent({
            title: 'LLM Provider Setup Required',
            metadata: '',
            text: message
        });

        // Add event listener after updating content
        const optionsLink = this.summaryPanel.panel.querySelector('#options-page-link');
        if (optionsLink) {
            optionsLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openOptionsPage();
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
            // this.logDebug('1. Formatted comment:', formattedComment);

            // Remove unnecessary anchor tags from the text
            formattedComment = this.stripAnchors(formattedComment);

            switch (aiProvider) {

                case 'none':
                    // For debugging purpose, show the formatted comment or any text as summary in the panel
                    this.showSummaryInPanel(formattedComment, true, 0, commentPathToIdMap).catch(error => {
                        Logger.errorSync('Error showing summary:', error);
                    });
                    break;
                case 'ollama':
                    const ollamaUrl = settings?.ollama?.url || 'http://localhost:11434';
                    await this.summarizeUsingOllama(formattedComment, model, ollamaUrl, commentPathToIdMap);
                    break;
                // AI providers supported by Vercel AI SDK. Use the common summarize method
                case 'openai':
                case 'anthropic':
                case 'google':
                case 'openrouter':
                    const apiKey = settings?.[aiProvider]?.apiKey;
                    await this.summarizeTextWithLLM(aiProvider, model, apiKey, formattedComment, commentPathToIdMap);
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

    async summarizeTextWithLLM(aiProvider, modelId, apiKey, text, commentPathToIdMap) {
        // Validate required parameters
        if (!text || !aiProvider || !modelId || !apiKey) {
            await Logger.error('Missing required parameters for AI summarization');
            this.showConfigureAIMessage();
            return;
        }

        Logger.debugSync(`Summarizing with ${aiProvider} / ${modelId}`);

        // Get the configuration based on provider and model
        const modelConfig = this.getModelConfiguration(aiProvider, modelId);

        // Handle input token limits based on model configuration
        const tokenLimitText = this.splitInputTextAtTokenLimit(text, modelConfig.inputTokenLimit);

        // Create the system and user prompts for better summarization
        const systemPrompt = await this.getSystemMessage();
        const postTitle = this.getHNPostTitle()
        const userPrompt = await this.getUserMessage(postTitle, tokenLimitText);

        // this.logDebug('2. System prompt:', systemPrompt);
        // this.logDebug('3. User prompt:', userPrompt);

        // Prepare model parameters with defaults and overrides
        const parameters = {
            temperature: modelConfig.temperature ?? 0.7,
            topP: modelConfig.topP,
            frequencyPenalty: modelConfig.frequencyPenalty,
            presencePenalty: modelConfig.presencePenalty,
            maxOutputTokens: modelConfig.outputTokenLimit ?? undefined
        };

        const llmInput = {
            aiProvider,
            modelId,
            apiKey,
            systemPrompt,
            userPrompt,
            parameters,
        };

        sendBackgroundMessage('HN_SUMMARIZE', llmInput).then(data => {
            const summary = data?.summary;
            if (!summary) {
                throw new Error('Empty summary returned from background message HN_SUMMARIZE. data: ' + JSON.stringify(data));
            }
            // this.logDebug('4. Summary:', summary);

            // Update the summary panel with the generated summary
            this.showSummaryInPanel(summary, false, data.duration, commentPathToIdMap)
                .catch(error => {
                    Logger.errorSync('Failed to show summary in summary panel in summarizeTextWithLLM(). Error:', error.message);
                });
        }).catch(error => {
            Logger.errorSync('LLM summarization failed in summarizeTextWithLLM(). Error:', error.message);
            this.handleSummaryError(error);
        });
    }

    // Helper method to get model-specific configuration
    getModelConfiguration(provider, modelId) {
        const defaultConfig = {
            inputTokenLimit: 15000,  // Maximum tokens to include from input text
            outputTokenLimit: 4000,  // Maximum tokens allowed for generated summary
            temperature: 0.7,
            topP: undefined,
            frequencyPenalty: 0,
            presencePenalty: 0
        };

        // Model-specific configurations
        const modelConfigs = {
            'openai': {
                'gpt-5': { inputTokenLimit: 25000, temperature: 0.7 },
                'gpt-5-mini': { inputTokenLimit: 20000, temperature: 0.7 },
                'gpt-5-nano': { inputTokenLimit: 16000, temperature: 0.7 },
                'gpt-4.1-nano': { inputTokenLimit: 16000, temperature: 0.7 },
                'gpt-4': { inputTokenLimit: 25000, temperature: 0.7 },
                'gpt-4-turbo': { inputTokenLimit: 27000, temperature: 0.7 },
                'gpt-3.5-turbo': { inputTokenLimit: 16000, temperature: 0.7 }
            },
            'anthropic': {
                'claude-opus-4-1': { inputTokenLimit: 25000, outputTokenLimit: 4000, temperature: 0.7 },
                'claude-sonnet-4-0': { inputTokenLimit: 24000, outputTokenLimit: 4000, temperature: 0.7 },
                'claude-3-7-sonnet-latest': { inputTokenLimit: 24000, outputTokenLimit: 4000, temperature: 0.7 },
                'claude-3-5-sonnet-latest': { inputTokenLimit: 22000, outputTokenLimit: 4000, temperature: 0.7 },
                'claude-3-5-haiku-latest': { inputTokenLimit: 20000, outputTokenLimit: 3000, temperature: 0.7 },
                'claude-3-opus-latest': { inputTokenLimit: 25000, outputTokenLimit: 4000, temperature: 0.7 },
            },
            'google': {
                'gemini-3-pro-preview': { inputTokenLimit: 15000, temperature: 0.7 },
                'gemini-2.5-pro': { inputTokenLimit: 15000, temperature: 0.7 },
                'gemini-flash-latest': { inputTokenLimit: 15000, temperature: 0.7 },
                'gemini-2.5-flash': { inputTokenLimit: 15000, temperature: 0.7 },
                'gemini-2.5-flash-lite': { inputTokenLimit: 15000, temperature: 0.7 },
                'gemini-2.0-flash': { inputTokenLimit: 15000, temperature: 0.7 },
                'gemini-2.0-flash-lite': { inputTokenLimit: 15000, temperature: 0.7 }
            },
            'openrouter': {
                // These are placeholders - adjust based on actual models
                'claude-3-sonnet-20240229': { inputTokenLimit: 25000, outputTokenLimit: 3000, temperature: 0.7 },
            }
        };

        // Return model-specific config or fall back to provider default then global default
        return (modelConfigs[provider] && modelConfigs[provider][modelId])
            || (modelConfigs[provider] && modelConfigs[provider].default)
            || defaultConfig;
    }

    // Helper method to handle summary errors with user-friendly messages
    handleSummaryError(error) {
        let errorMessage = `Error generating summary. `;

        // Provide user-friendly error messages based on error type
        if (typeof error === 'string') {
            if (error.includes('API key')) {
                errorMessage += 'Please check your API key configuration.';
            } else if (error.includes('429')) {
                errorMessage += 'Rate limit exceeded. Please try again later.';
            } else if (error.includes('current quota')) {
                errorMessage += 'API quota exceeded. Please try again later.';
            } else {
                errorMessage += error;
            }
        } else if (error.message) {
            if (error.message.includes('API key')) {
                errorMessage += 'Please check your API key configuration.';
            } else if (error.message.includes('429')) {
                errorMessage += 'Rate limit exceeded. Please try again later.';
            } else if (error.message.includes('current quota')) {
                errorMessage += 'API quota exceeded. Please try again later.';
            } else {
                errorMessage += error.message;
            }
        } else {
            errorMessage += 'An unexpected error occurred. Please try again.';
        }

        // Update the summary panel with the error message
        this.summaryPanel.updateContent({
            title: 'Error',
            metadata: '',
            text: errorMessage
        });
    }

    async getSystemMessage() {
        const settings = await storage.getItem('sync:settings') || {};
        if (settings.promptCustomization && settings.systemPrompt) {
            return settings.systemPrompt;
        }
        return AI_SYSTEM_PROMPT;
    }

    async getUserMessage(title, text) {
        const settings = await storage.getItem('sync:settings') || {};
        if (settings.promptCustomization && settings.userPrompt) {
            return settings.userPrompt.replace(/\$\{title}/g, title).replace(/\$\{text}/g, text);
        }
        return AI_USER_PROMPT_TEMPLATE(title, text);
    }

    stripAnchors(text) {
        // Use a regular expression to match <a> tags and their contents
        const anchorRegex = /<a\b[^>]*>.*?<\/a>/g;

        // Replace all matches with an empty string
        return text.replace(anchorRegex, '');
    }

    splitInputTextAtTokenLimit(text, tokenLimit) {
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


    // Show the summary in the summary panel - format the summary for two steps:
    // 1. Replace markdown with HTML
    // 2. Replace path identifiers with comment IDs
    async showSummaryInPanel(summary, fromCache, duration, commentPathToIdMap = null) {

        const formattedSummary = this.createSummaryFragment(summary, commentPathToIdMap);

        const {aiProvider, model} = await this.getAIProviderModel();
        let subtitle = null;
        if (fromCache) {
            const durationText = duration || 'some time';
            subtitle = this.buildFragment([
                'Summary generated by ',
                this.createStrong('HNCompanion'),
                ' and cached ',
                this.createStrong(durationText),
                ' ago.',
                document.createElement('br'),
                this.createInternalLink('llm-summarize-link', 'Generate fresh summary'),
                ' using LLM ',
                this.createInternalLink('options-page-link', 'configured in settings'),
                '.'
            ]);
        } else if (aiProvider) {
            subtitle = this.buildFragment([
                'Summarized using ',
                this.createStrong(`${aiProvider}/${model || ''}`),
                ' in ',
                this.createStrong(`${duration || '0'} secs`),
                '.'
            ]);
        }

        this.summaryPanel.updateContent({
            metadata: subtitle,
            text: formattedSummary
        });

        // Once the 'refresh cache' link is added to the DOM, add the click handler for the Options page link
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

        // Now that the summary links are in the DOM< attach listeners to those hyperlinks to navigate to the respective comments
        document.querySelectorAll('[data-comment-link="true"]').forEach(link => {

            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = link.dataset.commentId;
                const comment = document.getElementById(id);
                if(comment) {
                    this.setCurrentComment(comment);
                } else {
                    Logger.infoSync('Failed to find DOM element for comment id:', id);
                }
            });
        });
    }

    async summarizeUsingOllama(text, model, ollamaUrl, commentPathToIdMap) {
        // Validate required parameters
        if (!text || !model) {
            await Logger.error('Missing required parameters for Ollama summarization');
            this.showConfigureAIMessage();
            return;
        }

        // Set up the API request
        const endpoint = `${ollamaUrl}/api/generate`;

        // Create the system message for better summarization
        const systemMessage = await this.getSystemMessage();

        // Create the user message with the text to summarize
        const title = this.getHNPostTitle();
        const userMessage = await this.getUserMessage(title, text);

        // this.logDebug('2. System message:', systemMessage);
        // this.logDebug('3. User message:', userMessage);

        // Prepare the request payload
        const payload = {
            model: model,
            system: systemMessage,
            prompt: userMessage,
            stream: false
        };

        // Make the API request using background message
        sendBackgroundMessage('FETCH_API_REQUEST', {
            url: endpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            timeout: 180_000 // Longer timeout for summarization
        })
            .then(data => {
                const summary = data.response;
                if (!summary) {
                    throw new Error('No summary generated from API response');
                }
                // this.logDebug('4. Summary:', summary);

                // Update the summary panel with the generated summary
                this.showSummaryInPanel(summary, false, data.duration, commentPathToIdMap).catch(error => {
                    Logger.errorSync('Error showing summary:', error);
                });

            }).catch(error => {
            Logger.errorSync('Error in Ollama summarization:', error);

            // Provide user-friendly error messages for common issues
            let errorContent;
            if (error.message?.includes('403')) {
                // Create a formatted DOM fragment for the CORS error
                const fragment = document.createDocumentFragment();
                
                const intro = document.createElement('p');
                intro.textContent = 'Ollama blocked the request (likely a CORS or server configuration issue).';
                fragment.appendChild(intro);
                
                const fixHeader = document.createElement('p');
                fixHeader.innerHTML = '<strong>To fix:</strong>';
                fragment.appendChild(fixHeader);
                
                const list = document.createElement('ol');
                
                const li1 = document.createElement('li');
                li1.textContent = 'Restart Ollama with CORS enabled:';
                const code = document.createElement('code');
                code.textContent = 'OLLAMA_ORIGINS="https://news.ycombinator.com,chrome-extension://*,moz-extension://*" ollama serve';
                code.style.display = 'block';
                code.style.marginTop = '0.5em';
                code.style.padding = '0.5em';
                code.style.backgroundColor = 'rgba(0,0,0,0.1)';
                code.style.borderRadius = '4px';
                li1.appendChild(code);
                list.appendChild(li1);
                
                const li2 = document.createElement('li');
                li2.textContent = 'Verify the Ollama URL in the extension settings and ensure Ollama is running.';
                list.appendChild(li2);
                
                fragment.appendChild(list);
                
                const footer = document.createElement('p');
                footer.textContent = 'If the problem continues, check Ollama logs or the extension settings for more details.';
                footer.style.marginTop = '1em';
                footer.style.fontSize = '0.9em';
                footer.style.opacity = '0.8';
                fragment.appendChild(footer);
                
                errorContent = fragment;
            } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
                errorContent = 'Could not connect to Ollama. Please ensure Ollama is running.';
            } else {
                errorContent = 'Error generating summary. ' + error.message;
            }

            // Update the summary panel with an error message
            this.summaryPanel.updateContent({
                title: 'Error',
                metadata: '',
                text: errorContent
            });
        });
    }

    getHNPostTitle() {
        return document.title;
    }

    setupCommentClickHandlers() {
        // Add click listeners to all comment elements for focus functionality
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

    saveNavigationState(comment) {
        // Only save to history if we have a current comment, and it's different from the new one
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
            this.navigationHistory.shift(); // Remove oldest entry
        }

        Logger.debugSync(`Navigation state saved. History length: ${this.navigationHistory.length}`);
    }

    undoNavigation() {
        // Need at least one item in history to undo to
        if (this.navigationHistory.length === 0) {
            Logger.debugSync('No navigation history available for undo');
            return;
        }

        // Get the last navigation state (but don't remove it yet)
        const lastState = this.navigationHistory[this.navigationHistory.length - 1];

        // If the last state is the current comment, we need to go back further
        if (lastState.comment === this.currentComment && this.navigationHistory.length > 1) {
            // Remove the current state and get the previous one
            this.navigationHistory.pop();
            const previousState = this.navigationHistory[this.navigationHistory.length - 1];
            this.setCurrentComment(previousState.comment, true, false); // Don't save to history
            Logger.debugSync('Undid navigation to comment:', previousState.comment.id);
        } else if (lastState.comment !== this.currentComment) {
            // Go back to the last state
            this.setCurrentComment(lastState.comment, true, false); // Don't save to history
            Logger.debugSync('Undid navigation to comment:', lastState.comment.id);
        } else {
            Logger.debugSync('No previous navigation state to undo to');
        }
    }
}

export default HNEnhancer;
