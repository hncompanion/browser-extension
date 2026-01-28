import {storage} from '#imports';
import {browser} from 'wxt/browser';
import {qualifyCommentLinks} from './comment-processor.js';

// SVG Icon constants
const ICONS = {
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 494.09 486.75" width="20" height="20"><defs><style>.cls-2{stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:15px;fill:none}</style></defs><g><g><g><g><path d="M413.15 7.5h10.95c34.52 0 62.49 27.68 62.49 61.83v348.09c0 34.15-27.98 61.83-62.49 61.83H61.65c-34.52 0-54.15-27.68-54.15-61.83V69.33C7.5 35.18 27.14 7.5 61.65 7.5h351.49" style="stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:15px;fill:#ffe4b5"/></g><g><path d="M95.66 58.31c0-11.18-9.16-20.25-20.47-20.25s-20.47 9.07-20.47 20.25 9.16 20.25 20.47 20.25 20.47-9.07 20.47-20.25Z" class="cls-2"/></g><g><path d="M160.73 58.31c0-11.18-9.16-20.25-20.47-20.25s-20.47 9.07-20.47 20.25 9.16 20.25 20.47 20.25 20.47-9.07 20.47-20.25Z" class="cls-2"/></g><g><path d="M225.8 58.31c0-11.18-9.16-20.25-20.47-20.25s-20.47 9.07-20.47 20.25 9.16 20.25 20.47 20.25 20.47-9.07 20.47-20.25Z" class="cls-2"/></g><g><path d="M446.68 141.95v275.47c0 15.8-12.95 28.61-28.92 28.61H67.99c-15.97 0-20.58-12.81-20.58-28.61V141.95c0-19.35 7.51-35.04 27.07-35.04h336.8c19.56 0 35.41 15.69 35.41 35.04Z" style="fill:#f60;stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:15px"/></g></g></g></g><text style="font-family:Menlo-Regular,Menlo;font-size:224.1px" transform="translate(176.05 370.37)"><tspan x="0" y="0">Y</tspan></text></svg>`,
    gear: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor">
        <path d="m17.3 10.453 1.927.315a.326.326 0 0 1 .273.322v1.793a.326.326 0 0 1-.27.321l-1.93.339c-.111.387-.265.76-.459 1.111l1.141 1.584a.326.326 0 0 1-.034.422l-1.268 1.268a.326.326 0 0 1-.418.037l-1.6-1.123a5.482 5.482 0 0 1-1.118.468l-.34 1.921a.326.326 0 0 1-.322.269H11.09a.325.325 0 0 1-.321-.272l-.319-1.911a5.5 5.5 0 0 1-1.123-.465l-1.588 1.113a.326.326 0 0 1-.418-.037L6.052 16.66a.327.327 0 0 1-.035-.42l1.123-1.57a5.497 5.497 0 0 1-.47-1.129l-1.901-.337a.326.326 0 0 1-.269-.321V11.09c0-.16.115-.296.273-.322l1.901-.317c.115-.393.272-.77.47-1.128l-1.11-1.586a.326.326 0 0 1 .037-.417L7.34 6.052a.326.326 0 0 1 .42-.034l1.575 1.125c.354-.194.73-.348 1.121-.46l.312-1.91a.326.326 0 0 1 .322-.273h1.793c.159 0 .294.114.322.27l.336 1.92c.389.112.764.268 1.12.465l1.578-1.135a.326.326 0 0 1 .422.033l1.268 1.268a.326.326 0 0 1 .036.418L16.84 9.342c.193.352.348.724.46 1.11ZM9.716 12a2.283 2.283 0 1 0 4.566 0 2.283 2.283 0 0 0-4.566 0Z" clip-rule="evenodd"/>
    </svg>`,
    close: `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path fill-rule="evenodd" d="M19.207 6.207a1 1 0 0 0-1.414-1.414L12 10.586 6.207 4.793a1 1 0 0 0-1.414 1.414L10.586 12l-5.793 5.793a1 1 0 1 0 1.414 1.414L12 13.414l5.793 5.793a1 1 0 0 0 1.414-1.414L13.414 12l5.793-5.793z" clip-rule="evenodd"/>
    </svg>`,
    refresh: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>`,
    copy: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>`,
    help: `<svg viewBox="0 0 512 512" width="20" height="20" fill="currentColor" stroke="currentColor">
        <path d="M256 80a176 176 0 1 0 176 176A176 176 0 0 0 256 80Z" style="fill:none;stroke-miterlimit:10;stroke-width:32px"/>
        <path d="M200 202.29s.84-17.5 19.57-32.57C230.68 160.77 244 158.18 256 158c10.93-.14 20.69 1.67 26.53 4.45 10 4.76 29.47 16.38 29.47 41.09 0 26-17 37.81-36.37 50.8S251 281.43 251 296" style="fill:none;stroke-linecap:round;stroke-miterlimit:10;stroke-width:28px"/>
        <circle cx="250" cy="348" r="20"/>
    </svg>`
};

const STORAGE_KEY_PANEL_WIDTH = 'local:panelWidth';

class SummaryPanel {
    constructor() {
        this.panel = this.createPanel();
        this.contentUpdated = false;  // Track if updateContent has been called
        this.onRefresh = null;  // Callback for refresh button
        this.onHelp = null;  // Callback for help button
        this.onVisibilityChange = null;  // Callback when panel visibility changes

        // State for copy-to-clipboard with qualified links
        this.rawMarkdown = null;
        this.commentPathToIdMap = null;
        this.postId = null;

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

        // Assemble the panel from sections (Header, Content, Footer)
        //  The UI spec is defined in docs/summary-panel-ui-spec.md
        const header = this.createGlobalHeader();
        const content = this.createContent();
        const footer = this.createGlobalFooter();

        panel.appendChild(header);
        panel.appendChild(content);
        panel.appendChild(footer);

        return panel;
    }

    /**
     * Creates the global header section with branding, controls, and tabs.
     * This is a panel-wide element that persists across all tab views.
     * @returns {HTMLElement} The header element
     */
    createGlobalHeader() {
        const header = document.createElement('div');
        header.className = 'summary-panel-header';

        // Header top row: branding + controls
        const headerTop = document.createElement('div');
        headerTop.className = 'summary-panel-header-top';

        // Branding (logo + text)
        const branding = document.createElement('div');
        branding.className = 'summary-panel-branding';

        const logo = document.createElement('span');
        logo.className = 'summary-panel-logo';
        logo.innerHTML = ICONS.logo;
        branding.appendChild(logo);

        const logoText = document.createElement('span');
        logoText.className = 'summary-panel-logo';
        logoText.innerText = 'HN Companion';
        branding.appendChild(logoText);

        headerTop.appendChild(branding);

        // Controls (settings, help, close)
        const controls = document.createElement('div');
        controls.className = 'summary-panel-controls';

        const settingsBtn = this.createIconButton('settings', ICONS.gear, 'Open settings');
        settingsBtn.addEventListener('click', () => {
            browser.runtime.sendMessage({ type: 'HN_SHOW_OPTIONS', data: {} });
        });
        controls.appendChild(settingsBtn);

        const helpBtn = this.createIconButton('help', ICONS.help, 'Keyboard shortcuts (?)');
        helpBtn.addEventListener('click', () => {
            if (this.onHelp) this.onHelp();
        });
        controls.appendChild(helpBtn);

        const closeBtn = this.createIconButton('close', ICONS.close, 'Close panel');
        closeBtn.addEventListener('click', () => this.toggle());
        controls.appendChild(closeBtn);

        headerTop.appendChild(controls);
        header.appendChild(headerTop);

        // Tabs row (global context switcher)
        const tabs = this.createTabs();
        header.appendChild(tabs);

        return header;
    }

    /**
     * Creates the tabs row for switching between panel views.
     * Currently only contains Summary tab; extensible for future tabs.
     * @returns {HTMLElement} The tabs container element
     */
    createTabs() {
        const tabs = document.createElement('div');
        tabs.className = 'summary-panel-tabs';

        const summaryTab = document.createElement('button');
        summaryTab.className = 'summary-panel-tab active';
        summaryTab.dataset.tab = 'summary';
        summaryTab.textContent = 'Summary';
        tabs.appendChild(summaryTab);

        return tabs;
    }

    /**
     * Creates the main content area containing the summary tab content.
     * Includes the metadata row (tab header) and summary text area.
     * @returns {HTMLElement} The content container element
     */
    createContent() {
        const content = document.createElement('div');
        content.className = 'summary-panel-content';

        // Set up scroll shadow detection
        content.addEventListener('scroll', () => {
            if (content.scrollTop > 0) {
                content.classList.add('is-scrolled');
            } else {
                content.classList.remove('is-scrolled');
            }
        });

        // Summary tab header (metadata row with info + actions)
        const metadataRow = this.createSummaryTabHeader();
        content.appendChild(metadataRow);

        // Summary text area
        const text = document.createElement('div');
        text.className = 'summary-text';
        text.textContent = "Press 's' or click 'summarize all comments' to generate an AI summary of this discussion.";
        content.appendChild(text);

        return content;
    }

    /**
     * Creates the summary tab header row containing metadata info and action buttons.
     * This is tab-specific content (not global), showing cache status, age, provider, and actions.
     * @returns {HTMLElement} The metadata row element
     */
    createSummaryTabHeader() {
        const metadataRow = document.createElement('div');
        metadataRow.className = 'summary-metadata-row';
        metadataRow.style.display = 'none'; // Hidden until content is set

        const metadataInfo = document.createElement('div');
        metadataInfo.className = 'summary-metadata-info';

        const metadataActions = document.createElement('div');
        metadataActions.className = 'summary-metadata-actions';

        // Generate link (styled as text link)
        const generateLink = document.createElement('a');
        generateLink.className = 'summary-generate-link';
        generateLink.href = '#';
        generateLink.title = 'Generate fresh summary using the LLM configured in settings';
        generateLink.innerHTML = `${ICONS.refresh} Regenerate with your LLM`;
        generateLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.onRefresh) this.onRefresh();
        });
        metadataActions.appendChild(generateLink);

        // Copy button (icon only)
        const copyBtn = this.createIconButton('copy', ICONS.copy, 'Copy summary');
        copyBtn.style.display = 'none'; // Hidden by default, shown when content exists
        copyBtn.addEventListener('click', () => this.copyToClipboard());
        metadataActions.appendChild(copyBtn);

        metadataRow.appendChild(metadataInfo);
        metadataRow.appendChild(metadataActions);

        return metadataRow;
    }

    /**
     * Creates the global footer with links (Privacy, FAQ, About).
     * This is a panel-wide element that persists across all tab views.
     * @returns {HTMLElement} The footer element
     */
    createGlobalFooter() {
        const footer = document.createElement('div');
        footer.className = 'summary-panel-footer';

        const footerLinks = document.createElement('div');
        footerLinks.className = 'summary-footer-links';

        const createFooterLink = (text, href) => {
            const link = document.createElement('a');
            link.className = 'summary-footer-link';
            link.href = href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = text;
            return link;
        };

        const createFooterSeparator = () => {
            const separator = document.createElement('span');
            separator.className = 'summary-footer-separator';
            separator.textContent = '|';
            return separator;
        };

        footerLinks.appendChild(createFooterLink('About', 'https://hncompanion.com'));
        footerLinks.appendChild(createFooterSeparator());
        footerLinks.appendChild(createFooterLink('FAQ', 'https://hncompanion.com/#faq'));
        footerLinks.appendChild(createFooterSeparator());
        footerLinks.appendChild(createFooterLink('GitHub', 'https://github.com/hncompanion/browser-extension'));
        footerLinks.appendChild(createFooterSeparator());
        footerLinks.appendChild(createFooterLink('Privacy', 'https://hncompanion.com/privacy'));
        footer.appendChild(footerLinks);

        return footer;
    }

    createIconButton(name, icon, title) {
        const btn = document.createElement('button');
        btn.className = `summary-panel-icon-btn summary-panel-${name}-btn`;
        btn.innerHTML = icon;
        btn.title = title;
        btn.type = 'button';
        return btn;
    }

    async copyToClipboard() {
        if (!this.rawMarkdown) return;

        const text = qualifyCommentLinks(
            this.rawMarkdown,
            this.commentPathToIdMap,
            this.postId
        );

        try {
            await navigator.clipboard.writeText(text);
            // Brief visual feedback on summary copy button
            const copyBtn = this.panel.querySelector('.summary-panel-copy-btn');
            if (copyBtn) {
                const originalTitle = copyBtn.title;
                copyBtn.title = 'Copied!';
                setTimeout(() => {
                    copyBtn.title = originalTitle;
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    }

    updateCopyButtonVisibility(hasContent) {
        const copyBtn = this.panel?.querySelector('.summary-panel-copy-btn');
        if (copyBtn) {
            copyBtn.style.display = hasContent ? 'flex' : 'none';
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

            // Notify visibility change
            if (this.onVisibilityChange) this.onVisibilityChange(true);
        } else {
            this.panel.style.display = 'none';
            this.resizer.style.display = 'none';

            if (hnTable) {
                hnTable.style.removeProperty('min-width');
                hnTable.style.removeProperty('width');
            }

            // Notify visibility change
            if (this.onVisibilityChange) this.onVisibilityChange(false);
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

    /**
     * @typedef {'loading' | 'cached' | 'generated' | 'error' | 'setup-required'} SummaryState
     *
     * @typedef {Object} SummaryMetadata
     * @property {SummaryState} state
     * @property {string} [statusText]     - e.g., "23m ago", "generating..."
     * @property {string} [provider]       - e.g., "HN Companion", "anthropic/claude-3-haiku"
     * @property {string} [providerUrl]    - Optional link for provider
     * @property {string} [generationTime] - e.g., "4.2s"
     */

    /**
     * Update panel content with structured metadata
     * @param {Object} params
     * @param {Node|string} params.text - The summary content
     * @param {SummaryMetadata} params.metadata - Structured metadata for the summary
     * @param {string} [params.rawMarkdown] - Raw markdown for clipboard copy
     * @param {Map} [params.commentPathToIdMap] - Map of path → comment ID
     * @param {string} [params.postId] - HN post ID for URL construction
     */
    updateContent({ text, metadata, rawMarkdown, commentPathToIdMap, postId }) {
        if (!this.panel) return;

        // Store for copy operation
        this.rawMarkdown = rawMarkdown ?? null;
        this.commentPathToIdMap = commentPathToIdMap ?? null;
        this.postId = postId ?? null;

        this.contentUpdated = true;  // Mark that content has been updated

        if (!this.isVisible) {
            this.toggle();
        }

        const textElement = this.panel.querySelector('.summary-text');
        if (textElement && text !== undefined) {
            this.setElementContent(textElement, text);
            // Show copy button only for actual summary content, not for error/setup states
            const isErrorState = metadata?.state === 'error' || metadata?.state === 'setup-required';
            const hasContent = !isErrorState && text && (text instanceof Node || String(text).length > 0);
            this.updateCopyButtonVisibility(hasContent);
        }

        // Update the metadata row based on state
        this.updateMetadataRow(metadata);
    }

    updateMetadataRow(metadata) {
        const metadataRow = this.panel?.querySelector('.summary-metadata-row');
        const metadataInfo = this.panel?.querySelector('.summary-metadata-info');
        if (!metadataRow || !metadataInfo) return;

        metadataInfo.replaceChildren();

        // Hide for non-display states
        if (!metadata || metadata.state === 'loading' || metadata.state === 'error' || metadata.state === 'setup-required') {
            metadataRow.style.display = 'none';
            return;
        }

        metadataRow.style.display = 'flex';

        if (metadata.state === 'cached') {
            this.renderCachedMetadata(metadataInfo, metadata);
        } else if (metadata.state === 'generated') {
            this.renderGeneratedMetadata(metadataInfo, metadata);
        }
    }

    renderCachedMetadata(container, metadata) {
        // "[CACHED] 23m ago | HN Companion"
        const cacheChip = document.createElement('span');
        cacheChip.className = 'summary-metadata-chip summary-metadata-chip-cached';
        cacheChip.textContent = 'Cached';
        container.appendChild(cacheChip);

        if (metadata.statusText) {
            const ageSpan = document.createElement('span');
            ageSpan.className = 'summary-metadata-primary';
            ageSpan.textContent = metadata.statusText;
            container.appendChild(ageSpan);
        }
        if (metadata.provider) {
            if (metadata.statusText) {
                const sep = document.createElement('span');
                sep.className = 'summary-metadata-separator';
                sep.textContent = ' | ';
                container.appendChild(sep);
            }
            if (metadata.providerUrl) {
                const link = document.createElement('a');
                link.href = metadata.providerUrl;
                link.target = '_blank';
                link.textContent = metadata.provider;
                link.className = 'summary-metadata-provider-link';
                container.appendChild(link);
            } else {
                const span = document.createElement('span');
                span.className = 'summary-metadata-primary';
                span.textContent = metadata.provider;
                container.appendChild(span);
            }
        }
    }

    renderGeneratedMetadata(container, metadata) {
        // "[GENERATED] 33s | google/gemini-2.5-pro"
        const generatedChip = document.createElement('span');
        generatedChip.className = 'summary-metadata-chip summary-metadata-chip-generated';
        generatedChip.textContent = 'Generated';
        container.appendChild(generatedChip);

        if (metadata.generationTime) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'summary-metadata-primary';
            timeSpan.textContent = metadata.generationTime;
            container.appendChild(timeSpan);
        }
        if (metadata.provider) {
            if (metadata.generationTime) {
                const sep = document.createElement('span');
                sep.className = 'summary-metadata-separator';
                sep.textContent = ' | ';
                container.appendChild(sep);
            }
            // Render provider as a link that opens settings
            const providerLink = document.createElement('a');
            providerLink.href = '#';
            providerLink.className = 'summary-metadata-provider-link';
            providerLink.textContent = metadata.provider;
            providerLink.title = 'Open settings to configure LLM provider';
            providerLink.addEventListener('click', (e) => {
                e.preventDefault();
                browser.runtime.sendMessage({ type: 'HN_SHOW_OPTIONS', data: {} });
            });
            container.appendChild(providerLink);
        }
    }
}

export default SummaryPanel;
