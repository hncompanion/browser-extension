class SummaryPanel {
    constructor() {
        this.panel = this.createPanel();
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
        mainHnTable.parentNode.insertBefore(mainWrapper, mainHnTable); // center > main-content-wrapper
        hnContentContainer.appendChild(mainHnTable);    // hn-content-container > table
        mainWrapper.appendChild(hnContentContainer);    // main-content-wrapper > hn-content-container

        const panel = document.createElement('div');
        panel.className = 'summary-panel';
        panel.style.display = 'none';

        // --- Header ---
        const header = document.createElement('div');
        header.className = 'summary-panel-header';

        const titleBar = document.createElement('div');
        titleBar.className = 'summary-panel-title-bar';
        
        const title = document.createElement('h3');
        title.className = 'summary-panel-title';
        title.textContent = 'HN Companion';
        titleBar.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'summary-panel-actions';
        titleBar.appendChild(actions);

        header.appendChild(titleBar);

        const tabs = document.createElement('div');
        tabs.className = 'summary-panel-tabs';
        const summaryTab = document.createElement('button');
        summaryTab.className = 'summary-tab active';
        summaryTab.textContent = 'Summary';
        tabs.appendChild(summaryTab);
        // Future tabs can be added here
        header.appendChild(tabs);

        // --- Content ---
        const content = document.createElement('div');
        content.className = 'summary-panel-content';
        
        // Removed separate metadata div as it's now in the header actions

        const text = document.createElement('div');
        text.className = 'summary-text';
        text.textContent = 'Select a thread to summarize.';

        content.appendChild(text);

        // --- Footer ---
        const footer = document.createElement('div');
        footer.className = 'summary-panel-footer';

        const poweredBy = document.createElement('span');
        poweredBy.textContent = 'Powered by AI';
        footer.appendChild(poweredBy);

        const link = document.createElement('a');
        link.className = 'summary-footer-link';
        link.href = 'https://github.com/hncompanion/browser-extension';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'More details';
        footer.appendChild(link);

        // --- Assembly ---
        panel.appendChild(header);
        panel.appendChild(content);
        panel.appendChild(footer);

        return panel;
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

    toggle() {
        if (!this.panel || !this.resizer || !this.mainWrapper) return;

        const hnTable = document.querySelector('#hnmain');
        const helpIcon = document.querySelector('.help-icon');

        if (!this.isVisible) {
            const maxAvailableWidth = this.mainWrapper.offsetWidth - this.resizerWidth;
            const {minWidth} = this.calculatePanelConstraints(maxAvailableWidth);
            this.panel.style.flexBasis = `${minWidth}px`;

            this.panel.style.display = 'flex'; // Use flex to maintain layout structure
            this.resizer.style.display = 'block';

            if (hnTable) hnTable.style.minWidth = '0';
            if (helpIcon) helpIcon.style.display = 'none'; // Hide floating help icon
        } else {
            this.panel.style.display = 'none';
            this.resizer.style.display = 'none';

            if (hnTable) {
                hnTable.style.removeProperty('min-width');
                hnTable.style.removeProperty('width');
            }
            if (helpIcon) helpIcon.style.display = 'flex'; // Restore floating help icon
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

    updateContent({ title, text, rawText, status, onRegenerate, onSettings, onHelp }) {
        if (!this.panel) return;

        if (!this.isVisible) {
            this.toggle();
        }

        const titleElement = this.panel.querySelector('.summary-panel-title');
        if (titleElement && title !== undefined) {
            titleElement.textContent = title ?? '';
        }

        // Update Actions/Status Bar
        const actionsContainer = this.panel.querySelector('.summary-panel-actions');
        if (actionsContainer) {
            actionsContainer.replaceChildren();

            if (status) {
                // Time Cached Info
                if (status.timeAgo) {
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'status-item';
                    timeSpan.title = `Summary generated ${status.timeAgo} ago`;
                    timeSpan.textContent = `🕒 ${status.timeAgo}`;
                    actionsContainer.appendChild(timeSpan);
                }

                // Regenerate Button
                if (onRegenerate) {
                    const regenBtn = document.createElement('button');
                    regenBtn.className = 'action-btn';
                    regenBtn.title = 'Generate fresh summary';
                    regenBtn.textContent = '↻'; // Refresh icon
                    regenBtn.onclick = (e) => {
                        e.preventDefault();
                        onRegenerate();
                    };
                    actionsContainer.appendChild(regenBtn);
                }

                // Help Button
                if (onHelp) {
                    const helpBtn = document.createElement('button');
                    helpBtn.className = 'action-btn';
                    helpBtn.title = 'Keyboard Shortcuts';
                    helpBtn.textContent = '?'; 
                    helpBtn.onclick = (e) => {
                        e.preventDefault();
                        onHelp();
                    };
                    actionsContainer.appendChild(helpBtn);
                }

                // Settings Button
                if (onSettings) {
                    const settingsBtn = document.createElement('button');
                    settingsBtn.className = 'action-btn';
                    settingsBtn.title = 'Configure AI Provider';
                    settingsBtn.textContent = '⚙'; // Gear icon
                    settingsBtn.onclick = (e) => {
                        e.preventDefault();
                        onSettings();
                    };
                    actionsContainer.appendChild(settingsBtn);
                }
            }
        }

        // Update Footer
        const footer = this.panel.querySelector('.summary-panel-footer');
        if (footer) {
            footer.replaceChildren();

            // Left: Provider Info
            const poweredBy = document.createElement('span');
            const providerName = (status && status.provider) ? status.provider : 'AI';
            poweredBy.textContent = `Powered by ${providerName}`;
            poweredBy.title = status && status.provider ? 'Model used for generation' : '';
            footer.appendChild(poweredBy);

            // Right: Actions
            const footerRight = document.createElement('div');
            footerRight.className = 'footer-actions';
            
            // Copy Button
            if (rawText) {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'action-btn copy-btn';
                copyBtn.title = 'Copy summary to clipboard';
                copyBtn.textContent = '📋';
                copyBtn.style.marginRight = '8px';
                
                copyBtn.onclick = async (e) => {
                    e.preventDefault();
                    try {
                        await navigator.clipboard.writeText(rawText);
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = '✓';
                        setTimeout(() => {
                            copyBtn.textContent = originalText;
                        }, 2000);
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                    }
                };
                footerRight.appendChild(copyBtn);
            }

            const link = document.createElement('a');
            link.className = 'summary-footer-link';
            link.href = 'https://github.com/hncompanion/browser-extension';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'More details';
            footerRight.appendChild(link);

            footer.appendChild(footerRight);
        }

        const textElement = this.panel.querySelector('.summary-text');
        if (textElement && text !== undefined) {
            this.setElementContent(textElement, text);
        }
    }
}

export default SummaryPanel;
