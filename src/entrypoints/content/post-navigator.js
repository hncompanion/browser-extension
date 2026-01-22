import HNState from './hnstate.js';
import { Logger } from '../../lib/utils.js';

// Supported HN paths for post navigation and sorting
const SUPPORTED_PATHS = new Set(['/', '/news', '/newest', '/ask', '/show', '/front', '/shownew']);

const SORT_MODES = ['default', 'points', 'time', 'comments'];

class PostNavigator {
    constructor(options = {}) {
        this.onSortComplete = options.onSortComplete || (() => {});

        this.postItems = [];
        this.activeSort = 'default';
        this.tableBody = null;
        this.footerRows = [];
        this.sortLabel = null;

        this.init();
    }

    static isSupportedPath(pathname) {
        return SUPPORTED_PATHS.has(pathname);
    }

    async init() {
        if (!PostNavigator.isSupportedPath(window.location.pathname)) {
            return;
        }

        try {
            this.postItems = this.loadPosts();

            if (this.postItems.length === 0) {
                return;
            }

            this.captureTableStructure();
            this.createSortUI();

            // Load sort mode saved from the state and apply it
            const savedSort = await HNState.getSortMode();

            // Apply saved sort mode
            this.setSortMode(savedSort || 'default', { persist: false, force: true });
        } catch (error) {
            Logger.errorSync('Failed to initialize post navigator module:', error);
        }
    }

    loadPosts() {
        // Select post rows (excluding comments), build structured post objects, and filter out any that failed to parse
        const rows = [...document.querySelectorAll('tr.athing:not(.comtr)')];
        return rows.map((row, index) => this.buildPostItem(row, index)).filter(Boolean);
    }

    buildPostItem(row, index) {
        const postId = row.getAttribute('id');
        const subtextRow = this.getSubtextRow(row);
        const subtext = subtextRow?.querySelector('.subtext');

        if (!postId || !subtext) {
            return null;
        }

        const scoreElement = subtext.querySelector('.score');
        const score = this.parseNumberFromText(scoreElement?.textContent) || 0;

        const commentLink = this.getCommentLink(subtext, postId);
        const commentCount = this.parseCommentCount(commentLink?.textContent) || 0;

        const timeElement = subtext.querySelector('.age');
        const timeValue = this.parseTimeValue(timeElement);

        const spacerRow = this.getSpacerRow(subtextRow);

        return {
            postId,
            titleRow: row,
            subtextRow,
            spacerRow,
            scoreElement,
            score,
            commentLink,
            commentCount,
            timeElement,
            timeValue,
            originalIndex: index
        };
    }

    getSubtextRow(row) {
        const candidate = row.nextElementSibling;
        if (candidate?.querySelector('.subtext')) {
            return candidate;
        }
        return null;
    }

    getSpacerRow(subtextRow) {
        const candidate = subtextRow?.nextElementSibling;
        if (candidate?.classList.contains('spacer')) {
            return candidate;
        }
        return null;
    }

    getCommentLink(subtext, postId) {
        if (!subtext) {
            return null;
        }

        // Find the comments link by checking for "comment" or "discuss" text
        const links = subtext.querySelectorAll('a');
        for (const link of links) {
            const href = link.getAttribute('href');
            const text = link.textContent.trim();

            if (href && href.includes(`item?id=${postId}`)) {
                if (text === 'discuss' || text.includes('comment')) {
                    return link;
                }
            }
        }
        return null;
    }

    parseNumberFromText(text) {
        if (!text) {
            return null;
        }
        const match = text.match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    }

    parseCommentCount(text) {
        if (!text) {
            return null;
        }
        const normalized = text.trim().toLowerCase();
        if (normalized === 'discuss') {
            return 0;
        }
        return this.parseNumberFromText(normalized);
    }

    parseTimeValue(element) {
        const title = element?.getAttribute('title');
        if (!title) {
            return 0;
        }

        // Format: "2025-01-19T10:00:00 1737277200" (ISO date + unix timestamp)
        const parts = title.split(' ');
        if (parts.length >= 1) {
            const parsed = Date.parse(parts[0]);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
        return 0;
    }

    captureTableStructure() {
        if (!this.postItems.length) {
            return;
        }

        this.tableBody = this.postItems[0].titleRow?.parentElement || null;
        if (!this.tableBody) {
            return;
        }

        // Track all rows that belong to posts
        const postRows = new Set();
        this.postItems.forEach(item => {
            postRows.add(item.titleRow);
            if (item.subtextRow) {
                postRows.add(item.subtextRow);
            }
            if (item.spacerRow) {
                postRows.add(item.spacerRow);
            }
        });

        // Footer rows are everything else (More link, etc.)
        this.footerRows = Array.from(this.tableBody.children).filter(row => !postRows.has(row));
    }

    // ==================== Sorting ====================
    
    createSortUI() {
        const pagetop = this.getSortPanelParent();
        if (!pagetop) {
            return null;
        }

        const container = document.createElement('span');
        container.className = 'hnc-sort-container';

        const label = document.createElement('span');
        label.className = 'hnc-sort-label';
        label.textContent = `sort: ${this.activeSort}`;
        label.title = 'Click or press s to change sort order';
        label.setAttribute('role', 'button');
        label.setAttribute('aria-label', 'Cycle sort mode');
        label.tabIndex = 0;

        label.addEventListener('click', () => {
            this.cycleSortMode();
        });

        label.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.cycleSortMode();
            }
        });

        container.appendChild(label);

        // Insert before login link if present, otherwise append
        const loginLink = pagetop.querySelector('a[href^="login"]');
        if (loginLink) {
            pagetop.insertBefore(document.createTextNode(' | '), loginLink);
            pagetop.insertBefore(container, loginLink);
            pagetop.insertBefore(document.createTextNode(' | '), loginLink);
        } else {
            pagetop.appendChild(document.createTextNode(' | '));
            pagetop.appendChild(container);
        }

        this.sortLabel = label;
        return label;
    }

    getSortPanelParent() {
        const headerRow = document.querySelector('body > center > table > tbody > tr:first-child');
        const headerCell = headerRow?.querySelector('td:last-child');
        if (!headerCell) {
            return null;
        }
        return headerCell.querySelector('.pagetop') || headerCell;
    }

    cycleSortMode() {
        const currentIndex = SORT_MODES.indexOf(this.activeSort);
        const nextIndex = (currentIndex + 1) % SORT_MODES.length;
        this.setSortMode(SORT_MODES[nextIndex]);
    }

    setSortMode(mode, { persist = true, force = false } = {}) {
        if (!SORT_MODES.includes(mode)) {
            return;
        }

        if (!force && this.activeSort === mode) {
            return;
        }

        this.activeSort = mode;

        if (persist) {
            HNState.setSortMode(mode);
        }

        this.updateSortLabel();
        this.applySort();
    }

    updateSortLabel() {
        if (this.sortLabel) {
            this.sortLabel.textContent = `sort: ${this.activeSort}`;
        }
    }

    applySort() {
        if (!this.tableBody) {
            return;
        }

        const sortedItems = this.getSortedItems(this.activeSort);
        const fragment = document.createDocumentFragment();

        sortedItems.forEach(item => {
            fragment.appendChild(item.titleRow);
            if (item.subtextRow) {
                fragment.appendChild(item.subtextRow);
            }
            if (item.spacerRow) {
                fragment.appendChild(item.spacerRow);
            }
        });

        // Append footer rows (More link, etc.)
        this.footerRows.forEach(row => fragment.appendChild(row));

        this.tableBody.textContent = '';
        this.tableBody.appendChild(fragment);

        this.applySortHighlight(this.activeSort);
        this.onSortComplete();
    }

    getSortedItems(mode) {
        const sorted = [...this.postItems];

        switch (mode) {
            case 'points':
                return sorted.sort((a, b) => b.score - a.score);
            case 'time':
                return sorted.sort((a, b) => b.timeValue - a.timeValue);
            case 'comments':
                return sorted.sort((a, b) => b.commentCount - a.commentCount);
            default:
                return sorted.sort((a, b) => a.originalIndex - b.originalIndex);
        }
    }

    applySortHighlight(mode) {
        // Remove existing highlights
        this.postItems.forEach(item => {
            item.scoreElement?.classList.remove('hnc-sort-active');
            item.timeElement?.classList.remove('hnc-sort-active');
            item.commentLink?.classList.remove('hnc-sort-active');
        });

        if (mode === 'default') {
            return;
        }

        // Add highlight to active sort column
        this.postItems.forEach(item => {
            switch (mode) {
                case 'points':
                    item.scoreElement?.classList.add('hnc-sort-active');
                    break;
                case 'time':
                    item.timeElement?.classList.add('hnc-sort-active');
                    break;
                case 'comments':
                    item.commentLink?.classList.add('hnc-sort-active');
                    break;
            }
        });
    }

}

export default PostNavigator;
