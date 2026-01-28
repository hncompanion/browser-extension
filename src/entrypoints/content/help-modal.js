/**
 * Help Modal Module
 * Self-contained help UI component for displaying keyboard shortcuts.
 */

/**
 * Shortcut group definitions for the help modal.
 */
export const shortcutGroups = {
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
            {key: 's', description: 'Sort posts (cycles: default / points / time / comments)'},
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

/**
 * Creates the help modal DOM element.
 * @param {Function} toggleFn - Function to call to toggle the modal visibility
 * @returns {HTMLElement} The modal element
 */
export function createHelpModal(toggleFn) {
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
    closeBtn.onclick = () => toggleFn(false);

    const table = document.createElement('table');

    for (const groupKey in shortcutGroups) {
        const group = shortcutGroups[groupKey];

        const headerRow = table.insertRow();
        const headerCell = headerRow.insertCell();
        headerCell.colSpan = 2;
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
            toggleFn(false);
        }
    });

    return modal;
}

/**
 * Creates the help icon that appears in the bottom-right corner.
 * @param {Function} onClickFn - Function to call when icon is clicked
 * @returns {HTMLElement} The icon element
 */
export function createHelpIcon(onClickFn) {
    const icon = document.createElement('div');
    icon.className = 'help-icon';
    icon.textContent = '?';
    icon.title = 'Keyboard Shortcuts (Press ? or / to toggle)';

    icon.onclick = () => onClickFn(true);

    document.body.appendChild(icon);
    return icon;
}

/**
 * Toggles the help modal visibility.
 * @param {HTMLElement} modal - The modal element
 * @param {boolean} show - Whether to show or hide
 */
export function toggleHelpModal(modal, show) {
    modal.style.display = show ? 'flex' : 'none';
}
