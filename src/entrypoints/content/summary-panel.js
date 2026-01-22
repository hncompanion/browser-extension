import {storage} from '#imports';
import {browser} from 'wxt/browser';

// SVG Icon constants
const ICONS = {
    logo: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>`,
    gear: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
    close: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`,
    refresh: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>`,
    collapse: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`,
    expand: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>`,
    copy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>`
};

const STORAGE_KEY_PANEL_WIDTH = 'local:panelWidth';

class SummaryPanel {
    constructor() {
        this.panel = this.createPanel();
        this.contentUpdated = false;  // Track if updateContent has been called
        this.isCollapsed = false;
        this.onRefresh = null;  // Callback for refresh button

        if (!this.panel) {
            this.resizer = null;
            this.mainWrapper = null;
            return;
        }

        this.resizer = this.createResizer();

        this.isResizing = false;
        this.startX = 0;
        this.startWidth = 0;
        this.resizerWidth = 8;

        // Attach panel and resizer to mainWrapper (created in createPanel)
        this.mainWrapper = document.querySelector('.main-content-wrapper');
        if (!this.mainWrapper) return;

        this.mainWrapper.appendChild(this.resizer);
        this.mainWrapper.appendChild(this.panel);

        // set up resize handlers at the resizer and at the window level
        this.setupResizeHandlers();
        this.setupWindowResizeHandler();
    }

    get isVisible() {
        return this.panel && this.panel.style.display !== 'none';
    }

    createPanel() {
        // Create wrapper for main content, resizer and panel
        const mainWrapper = document.createElement('div');
        mainWrapper.className = 'main-content-wrapper';

        // Get the main HN content
        const mainHnTable = document.querySelector('center > table');
        if (!mainHnTable) return null;

        // Create main content container
        const hnContentContainer = document.createElement('div');
        hnContentContainer.className = 'hn-content-container';

        // Move the main HN content inside our container
        mainHnTable.parentNode.insertBefore(mainWrapper, mainHnTable);
        hnContentContainer.appendChild(mainHnTable);
        mainWrapper.appendChild(hnContentContainer);

        const panel = document.createElement('div');
        panel.className = 'summary-panel';
        panel.style.display = 'none';

        // === HEADER ===
        const header = document.createElement('div');
        header.className = 'summary-panel-header';

        // Header top row: branding + controls
        const headerTop = document.createElement('div');
        headerTop.className = 'summary-panel-header-top';

        // Branding (logo + keyboard badge)
        const branding = document.createElement('div');
        branding.className = 'summary-panel-branding';

        const logo = document.createElement('span');
        logo.className = 'summary-panel-logo';
        logo.innerHTML = ICONS.logo;
        branding.appendChild(logo);

        const badge = document.createElement('span');
        badge.className = 'summary-panel-kbd-badge';
        badge.textContent = 'S';
        badge.title = 'Press S to toggle panel';
        branding.appendChild(badge);

        headerTop.appendChild(branding);

        // Controls (refresh, settings, collapse, close)
        const controls = document.createElement('div');
        controls.className = 'summary-panel-controls';

        const refreshBtn = this.createIconButton('refresh', ICONS.refresh, 'Refresh summary');
        refreshBtn.addEventListener('click', () => {
            if (this.onRefresh) this.onRefresh();
        });
        controls.appendChild(refreshBtn);

        const settingsBtn = this.createIconButton('settings', ICONS.gear, 'Open settings');
        settingsBtn.addEventListener('click', () => {
            browser.runtime.sendMessage({ type: 'HN_SHOW_OPTIONS', data: {} });
        });
        controls.appendChild(settingsBtn);

        const collapseBtn = this.createIconButton('collapse', ICONS.collapse, 'Collapse panel');
        collapseBtn.addEventListener('click', () => this.toggleCollapse());
        controls.appendChild(collapseBtn);

        const closeBtn = this.createIconButton('close', ICONS.close, 'Close panel');
        closeBtn.addEventListener('click', () => this.toggle());
        controls.appendChild(closeBtn);

        headerTop.appendChild(controls);
        header.appendChild(headerTop);

        // Tabs row
        const tabs = document.createElement('div');
        tabs.className = 'summary-panel-tabs';

        const summaryTab = document.createElement('button');
        summaryTab.className = 'summary-panel-tab active';
        summaryTab.dataset.tab = 'summary';
        summaryTab.textContent = 'Summary';
        tabs.appendChild(summaryTab);

        header.appendChild(tabs);

        // Double-click header to collapse
        header.addEventListener('dblclick', () => this.toggleCollapse());

        // === CONTENT ===
        const content = document.createElement('div');
        content.className = 'summary-panel-content';

        const metadata = document.createElement('div');
        metadata.className = 'summary-metadata';

        const text = document.createElement('div');
        text.className = 'summary-text';
        text.textContent = "Press 's' or click 'summarize all comments' to generate an AI summary of this discussion.";

        // Copy button (shows on hover)
        const copyBtn = document.createElement('button');
        copyBtn.className = 'summary-copy-btn';
        copyBtn.innerHTML = ICONS.copy + ' Copy';
        copyBtn.title = 'Copy summary to clipboard';
        copyBtn.addEventListener('click', () => this.copyToClipboard());

        content.appendChild(metadata);
        content.appendChild(text);
        content.appendChild(copyBtn);

        // === FOOTER ===
        const footer = document.createElement('div');
        footer.className = 'summary-panel-footer';

        const cacheStatus = document.createElement('span');
        cacheStatus.className = 'summary-cache-status';

        const providerInfo = document.createElement('span');
        providerInfo.className = 'summary-provider-info';

        footer.appendChild(cacheStatus);
        footer.appendChild(providerInfo);

        // Assemble panel
        panel.appendChild(header);
        panel.appendChild(content);
        panel.appendChild(footer);

        return panel;
    }

    createIconButton(name, icon, title) {
        const btn = document.createElement('button');
        btn.className = `summary-panel-icon-btn summary-panel-${name}-btn`;
        btn.innerHTML = icon;
        btn.title = title;
        btn.type = 'button';
        return btn;
    }

    toggleCollapse() {
        if (!this.panel) return;

        this.isCollapsed = !this.isCollapsed;
        this.panel.classList.toggle('summary-panel-collapsed', this.isCollapsed);

        // Update collapse button icon
        const collapseBtn = this.panel.querySelector('.summary-panel-collapse-btn');
        if (collapseBtn) {
            collapseBtn.innerHTML = this.isCollapsed ? ICONS.expand : ICONS.collapse;
            collapseBtn.title = this.isCollapsed ? 'Expand panel' : 'Collapse panel';
        }
    }

    async copyToClipboard() {
        const textElement = this.panel?.querySelector('.summary-text');
        if (!textElement) return;

        const text = textElement.innerText || textElement.textContent;
        try {
            await navigator.clipboard.writeText(text);
            // Brief visual feedback
            const copyBtn = this.panel.querySelector('.summary-copy-btn');
            if (copyBtn) {
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = ICONS.copy + ' Copied!';
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    }

    createResizer() {
        const resizer = document.createElement('div');
        resizer.className = 'panel-resizer';
        resizer.style.display = 'none';
        return resizer;
    }

    setupResizeHandlers() {
        if (!this.resizer || !this.panel || !this.mainWrapper) return;

        this.resizer.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            this.startX = e.clientX;
            this.startWidth = this.panel.offsetWidth;
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;

            const maxAvailableWidth = this.mainWrapper.offsetWidth - this.resizerWidth;
            const {minWidth, maxWidth} = this.calculatePanelConstraints(maxAvailableWidth);

            const deltaX = this.startX - e.clientX;
            const newPanelWidth = Math.max(minWidth, Math.min(maxWidth, this.startWidth + deltaX));

            this.panel.style.flexBasis = `${newPanelWidth}px`;
            this.adjustMainContentWidth(newPanelWidth, e.clientX);
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;
                document.body.style.userSelect = '';
                // Save the current width
                const currentWidth = this.panel.offsetWidth;
                this.saveWidth(currentWidth);
            }
        });
    }

    setupWindowResizeHandler() {
        if (!this.panel || !this.mainWrapper) return;

        window.addEventListener('resize', () => {
            if (this.isVisible) {
                const maxAvailableWidth = this.mainWrapper.offsetWidth - this.resizerWidth;
                const {minWidth, maxWidth} = this.calculatePanelConstraints(maxAvailableWidth);
                const currentWidth = this.panel.offsetWidth;

                if (currentWidth < minWidth) {
                    this.panel.style.flexBasis = `${minWidth}px`;
                } else if (currentWidth > maxWidth) {
                    this.panel.style.flexBasis = `${maxWidth}px`;
                }
            }
        });
    }

    calculatePanelConstraints(maxAvailableWidth) {
        if (maxAvailableWidth < 768) {
            return {
                minWidth: Math.min(200, maxAvailableWidth * 0.85),
                maxWidth: Math.min(300, maxAvailableWidth * 0.95)
            };
        }

        if (maxAvailableWidth < 1024) {
            return {
                minWidth: Math.min(350, maxAvailableWidth * 0.6),
                maxWidth: Math.min(500, maxAvailableWidth * 0.8)
            };
        }

        return {
            minWidth: Math.min(400, maxAvailableWidth * 0.3),
            maxWidth: Math.min(700, maxAvailableWidth * 0.4)
        };
    }

    adjustMainContentWidth(panelWidth, clientX) {
        const hnTable = document.querySelector('#hnmain');
        if (!hnTable) return;

        const viewportWidth = window.innerWidth;
        const availableWidth = viewportWidth - panelWidth - this.resizerWidth;
        const movePercent = (viewportWidth - clientX) / availableWidth;

        const tableWidthPercent = 85 + (14 * Math.min(1, movePercent * 1.5));
        const clampedTableWidthPercent = Math.min(99, Math.max(85, tableWidthPercent));
        hnTable.style.width = `${clampedTableWidthPercent}%`;
    }

    async toggle() {
        if (!this.panel || !this.resizer || !this.mainWrapper) return;

        const hnTable = document.querySelector('#hnmain');
        if (!this.isVisible) {
            const maxAvailableWidth = this.mainWrapper.offsetWidth - this.resizerWidth;
            const {minWidth, maxWidth} = this.calculatePanelConstraints(maxAvailableWidth);

            // Load saved width or use minWidth as default
            const savedWidth = await this.loadSavedWidth();
            const width = savedWidth
                ? Math.max(minWidth, Math.min(maxWidth, savedWidth))
                : minWidth;
            this.panel.style.flexBasis = `${width}px`;

            this.panel.style.display = 'flex';
            this.resizer.style.display = 'block';

            if (hnTable) hnTable.style.minWidth = '0';
        } else {
            this.panel.style.display = 'none';
            this.resizer.style.display = 'none';

            if (hnTable) {
                hnTable.style.removeProperty('min-width');
                hnTable.style.removeProperty('width');
            }
        }
    }

    async saveWidth(width) {
        try {
            await storage.setItem(STORAGE_KEY_PANEL_WIDTH, width);
        } catch (err) {
            console.error('Failed to save panel width:', err);
        }
    }

    async loadSavedWidth() {
        try {
            return await storage.getItem(STORAGE_KEY_PANEL_WIDTH);
        } catch (err) {
            console.error('Failed to load panel width:', err);
            return null;
        }
    }

    setElementContent(element, content) {
        if (!element) return;
        element.replaceChildren();
        if (content === null || content === undefined) return;
        if (content instanceof Node) {
            element.appendChild(content);
            return;
        }
        element.textContent = String(content);
    }

    updateContent({ title, metadata, text, cacheStatus, providerInfo }) {
        if (!this.panel) return;

        this.contentUpdated = true;  // Mark that content has been updated

        if (!this.isVisible) {
            this.toggle();
        }

        // Note: title is no longer used in the new design (tabs replace title)

        const metadataElement = this.panel.querySelector('.summary-metadata');
        if (metadataElement && metadata !== undefined) {
            this.setElementContent(metadataElement, metadata);
        }

        const textElement = this.panel.querySelector('.summary-text');
        if (textElement && text !== undefined) {
            this.setElementContent(textElement, text);
        }

        // Update footer elements
        const cacheStatusElement = this.panel.querySelector('.summary-cache-status');
        if (cacheStatusElement && cacheStatus !== undefined) {
            this.setElementContent(cacheStatusElement, cacheStatus);
        }

        const providerInfoElement = this.panel.querySelector('.summary-provider-info');
        if (providerInfoElement && providerInfo !== undefined) {
            this.setElementContent(providerInfoElement, providerInfo);
        }
    }
}

export default SummaryPanel;
