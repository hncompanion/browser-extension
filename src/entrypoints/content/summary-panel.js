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

        const header = document.createElement('div');
        header.className = 'summary-panel-header';

        const title = document.createElement('h3');
        title.className = 'summary-panel-title';
        title.textContent = 'Summary';
        header.appendChild(title);

        const content = document.createElement('div');
        content.className = 'summary-panel-content';
        const metadata = document.createElement('div');
        metadata.className = 'summary-metadata';

        const text = document.createElement('div');
        text.className = 'summary-text';
        text.append('Select a thread to summarize. More details ');
        const link = document.createElement('a');
        link.className = 'navs';
        link.href = 'https://github.com/hncompanion/browser-extension';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'here';
        text.appendChild(link);
        text.append('.');

        content.appendChild(metadata);
        content.appendChild(text);

        panel.appendChild(header);
        panel.appendChild(content);

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
        if (!this.isVisible) {
            const maxAvailableWidth = this.mainWrapper.offsetWidth - this.resizerWidth;
            const {minWidth} = this.calculatePanelConstraints(maxAvailableWidth);
            this.panel.style.flexBasis = `${minWidth}px`;

            this.panel.style.display = 'block';
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

    updateContent({ title, metadata, text }) {
        if (!this.panel) return;

        if (!this.isVisible) {
            this.toggle();
        }

        const titleElement = this.panel.querySelector('.summary-panel-title');
        if (titleElement && title !== undefined) {
            titleElement.textContent = title ?? '';
        }

        const metadataElement = this.panel.querySelector('.summary-metadata');
        if (metadataElement && metadata !== undefined) {
            this.setElementContent(metadataElement, metadata);
        }

        const textElement = this.panel.querySelector('.summary-text');
        if (textElement && text !== undefined) {
            this.setElementContent(textElement, text);
        }
    }
}

export default SummaryPanel;
