import './welcome.css';
import { browser } from 'wxt/browser';

document.addEventListener('DOMContentLoaded', () => {
    // Configure Settings button - opens options page
    const openOptionsBtn = document.getElementById('open-options');
    if (openOptionsBtn) {
        openOptionsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            browser.runtime.openOptionsPage();
        });
    }

    // Go to Hacker News button - redirects current tab to HN
    const goToHnBtn = document.getElementById('go-to-hn');
    if (goToHnBtn) {
        goToHnBtn.addEventListener('click', (e) => {
            // Let the link navigate naturally - no need to prevent default
        });
    }

    // Got it button - closes this tab
    const closeTabBtn = document.getElementById('close-tab');
    if (closeTabBtn) {
        closeTabBtn.addEventListener('click', () => {
            window.close();
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            window.close();
            return;
        }

        if (event.key === 'Enter') {
            const primaryAction = document.getElementById('go-to-hn');
            if (primaryAction) {
                primaryAction.click();
            }
        }
    });
});
