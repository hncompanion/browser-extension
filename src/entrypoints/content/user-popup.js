/**
 * User Popup Module
 * User hover popup and info display functionality.
 */

import {sendBackgroundMessage} from "../../lib/messaging.js";
import {sanitizeHtmlToFragment, enforceSafeLinks} from '../../lib/sanitize.js';
import {decodeHtmlEntities} from '../../lib/dom-utils.js';

/**
 * Creates the author popup DOM element.
 * @returns {HTMLElement} The popup element
 */
export function createAuthorPopup() {
    const popup = document.createElement('div');
    popup.className = 'author-popup';
    document.body.appendChild(popup);
    return popup;
}

/**
 * Fetches user info from HN API with caching.
 * @param {string} username - The HN username
 * @param {Map} userInfoCache - Cache map for user info
 * @returns {Promise<{karma: string, about: string}>}
 */
export async function fetchUserInfo(username, userInfoCache) {
    // Check cache first
    if (userInfoCache.has(username)) {
        return userInfoCache.get(username);
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
        about = decodeHtmlEntities(about);

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
        userInfoCache.set(username, result);
        return result;
    } catch (error) {
        return {
            karma: 'User info error',
            about: 'No about information'
        };
    }
}

/**
 * Sets up hover event handlers for all user elements.
 * @param {HTMLElement} popup - The popup element
 * @param {Map} userInfoCache - Cache map for user info
 * @param {Object} state - State object with isMouseOverUserOrPopup property
 */
export function setupUserHover(popup, userInfoCache, state) {
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
                const userInfo = await fetchUserInfo(username, userInfoCache);

                if (userInfo) {
                    popup.replaceChildren();

                    const name = document.createElement('strong');
                    name.textContent = username;
                    popup.appendChild(name);
                    popup.appendChild(document.createElement('br'));

                    popup.append(`Karma: ${userInfo.karma}`);
                    popup.appendChild(document.createElement('br'));

                    const aboutLabel = document.createElement('div');
                    aboutLabel.textContent = 'About:';
                    popup.appendChild(aboutLabel);

                    const aboutContent = document.createElement('div');
                    const aboutFragment = sanitizeHtmlToFragment(userInfo.about || '');
                    enforceSafeLinks(aboutFragment);
                    aboutContent.appendChild(aboutFragment);
                    popup.appendChild(aboutContent);

                    const rect = target.getBoundingClientRect();
                    popup.style.left = `${rect.left}px`;
                    popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
                    popup.style.display = 'block';

                    // Track whether mouse is over user element or popup
                    state.isMouseOverUserOrPopup = true;
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
                if (!state.isMouseOverUserOrPopup) {
                    popup.style.display = 'none';
                }
            }, 100);
            state.isMouseOverUserOrPopup = false;
        });
    });

    // Add mouse enter/leave events for the popup itself
    popup.addEventListener('mouseenter', () => {
        state.isMouseOverUserOrPopup = true;
    });

    popup.addEventListener('mouseleave', () => {
        state.isMouseOverUserOrPopup = false;
        popup.style.display = 'none';
    });

    // Add global event listeners to close the user popup on Esc key or click outside the user element or popup

    // Add event listener for Esc key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            popup.style.display = 'none';
        }
    });

    // Add event listener for clicks outside the popup
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !e.target.classList.contains('hnuser')) {
            popup.style.display = 'none';
        }
    });
}
