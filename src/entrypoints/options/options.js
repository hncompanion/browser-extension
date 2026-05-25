import './options.css';
import '@tailwindplus/elements';
import {AI_SYSTEM_PROMPT, AI_USER_PROMPT_STRING} from '../content/constants.js';
import {browser} from "wxt/browser";
import {storage} from '#imports';
import {Logger} from "../../lib/utils.js";
import {sendBackgroundMessage} from "../../lib/messaging.js";

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_CLOUD_URL = 'https://ollama.com';

const OPTIONAL_HOST_PERMISSIONS = {
    openai: ['https://api.openai.com/*'],
    anthropic: ['https://api.anthropic.com/*'],
    openrouter: ['https://openrouter.ai/*'],
    google: ['https://generativelanguage.googleapis.com/*'],
    ollama: ['http://localhost:11434/*'],
    'ollama-cloud': ['https://ollama.com/*'],
};

const PROVIDER_INPUT_SELECTORS = {
    google: ['#google-key', '#google-model'],
    anthropic: ['#anthropic-key', '#anthropic-model'],
    openai: ['#openai-key', '#openai-model'],
    openrouter: ['#openrouter-key', '#openrouter-model'],
    ollama: ['#ollama-url', '#ollama-model', '#ollama-key', '#ollama-cloud'],
    'ollama-cloud': ['#ollama-url', '#ollama-model', '#ollama-key', '#ollama-cloud'],
};

function resolveOllamaProvider(providerId) {
    return providerId === 'ollama-cloud' ? 'ollama' : providerId;
}

function getOllamaCardId(providerId) {
    return (providerId === 'ollama' || providerId === 'ollama-cloud') ? 'ollama' : providerId;
}

async function hasOptionalHostPermissions(origins) {
    if (!origins || origins.length === 0) {
        return true;
    }
    if (!browser.permissions?.contains) {
        return true;
    }
    try {
        return await browser.permissions.contains({origins});
    } catch (error) {
        await Logger.error('Error checking optional host permissions:', error);
        return false;
    }
}

async function requestOptionalHostPermissions(origins) {
    if (!browser.permissions?.request) {
        return true;
    }
    try {
        return await browser.permissions.request({origins});
    } catch (error) {
        await Logger.error('Error requesting optional host permissions:', error);
        return false;
    }
}

function setOllamaModelSelectStatus(text) {
    const selectElement = document.getElementById('ollama-model');
    if (!selectElement) return;
    selectElement.options.length = 0;
    const option = document.createElement('option');
    option.value = '';
    option.textContent = text;
    selectElement.appendChild(option);
}

function isOllamaCloudMode() {
    return document.getElementById('ollama-cloud').value === 'true';
}

function setOllamaMode(isCloud) {
    const localFields = document.getElementById('ollama-local-fields');
    const cloudFields = document.getElementById('ollama-cloud-fields');
    const corsHint = document.getElementById('ollama-cors-hint');
    const subtitle = document.getElementById('ollama-subtitle');
    const hiddenInput = document.getElementById('ollama-cloud');
    const localBtn = document.getElementById('ollama-mode-local');
    const cloudBtn = document.getElementById('ollama-mode-cloud');

    hiddenInput.value = isCloud ? 'true' : 'false';

    localFields.classList.toggle('hidden', isCloud);
    cloudFields.classList.toggle('hidden', !isCloud);
    if (corsHint) {
        corsHint.style.display = isCloud ? 'none' : '';
    }

    if (subtitle) {
        subtitle.textContent = isCloud
            ? 'Run models on Ollama\'s cloud. API key required.'
            : 'Local models running on your machine. No API key required.';
    }

    const sectionLabel = document.getElementById('ollama-section-label');
    if (sectionLabel) {
        sectionLabel.textContent = isCloud
            ? 'OLLAMA CLOUD PROVIDER (API key required)'
            : 'LOCAL AI PROVIDER (Free Option)';
    }

    const activeClasses = 'bg-indigo-600 text-white';
    const inactiveClasses = 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10';

    [localBtn, cloudBtn].forEach(btn => {
        btn.className = btn.className.replace(/bg-indigo-600|text-white|bg-white|text-gray-700|hover:bg-gray-50|dark:bg-white\/5|dark:text-gray-300|dark:hover:bg-white\/10/g, '').trim();
    });

    if (isCloud) {
        cloudBtn.classList.add(...activeClasses.split(' '));
        localBtn.classList.add(...inactiveClasses.split(' '));
    } else {
        localBtn.classList.add(...activeClasses.split(' '));
        cloudBtn.classList.add(...inactiveClasses.split(' '));
    }
}

function getOllamaEffectiveUrl() {
    return isOllamaCloudMode()
        ? OLLAMA_CLOUD_URL
        : (document.getElementById('ollama-url').value.replace(/\/+$/, '') || DEFAULT_OLLAMA_URL);
}

function getOllamaFetchHeaders() {
    if (!isOllamaCloudMode()) return {};
    const apiKey = document.getElementById('ollama-key').value;
    if (!apiKey) return {};
    return { 'Authorization': `Bearer ${apiKey}` };
}

function setPromptCustomizationState(isEnabled) {
    const systemPromptTextarea = document.getElementById('system-prompt');
    const userPromptTextarea = document.getElementById('user-prompt');
    const promptCustomizationFields = document.getElementById('prompt-customization-fields');

    if (promptCustomizationFields) {
        promptCustomizationFields.classList.toggle('hidden', !isEnabled);
    }

    if (!systemPromptTextarea || !userPromptTextarea) return;

    if (isEnabled) {
        systemPromptTextarea.removeAttribute('disabled');
        userPromptTextarea.removeAttribute('disabled');
        systemPromptTextarea.removeAttribute('readonly');
        userPromptTextarea.removeAttribute('readonly');
    } else {
        systemPromptTextarea.setAttribute('disabled', 'true');
        userPromptTextarea.setAttribute('disabled', 'true');
        systemPromptTextarea.setAttribute('readonly', 'true');
        userPromptTextarea.setAttribute('readonly', 'true');
    }
}

// Update the "Active" badge to show on the currently selected provider
function updateActiveProviderBadge(providerId) {
    // Allow empty string (None) as a valid selection
    const activeProvider = PROVIDER_INPUT_SELECTORS[providerId] ? providerId : '';
    const activeCardId = getOllamaCardId(activeProvider);

    const cardProviders = ['ollama', 'google', 'anthropic', 'openai', 'openrouter'];
    cardProviders.forEach((provider) => {
        const isActive = provider === activeCardId;
        const chip = document.querySelector(`[data-provider-chip="${provider}"]`);
        const card = document.querySelector(`[data-provider-card="${provider}"]`);

        if (chip) {
            chip.classList.toggle('hidden', !isActive);
            chip.classList.toggle('inline-flex', isActive);
        }

        if (card) {
            card.classList.toggle('ring-2', isActive);
            card.classList.toggle('ring-indigo-500/40', isActive);
        }
    });
}

// Toggle a provider card's expanded/collapsed state
async function toggleProviderCard(providerId) {
    const body = document.querySelector(`[data-provider-body="${providerId}"]`);
    const toggle = document.querySelector(`[data-provider-toggle="${providerId}"]`);
    const chevron = document.querySelector(`[data-provider-chevron="${providerId}"]`);

    if (!body) return;

    const isCurrentlyHidden = body.classList.contains('hidden');

    body.classList.toggle('hidden', !isCurrentlyHidden);

    if (toggle) {
        toggle.setAttribute('aria-expanded', isCurrentlyHidden ? 'true' : 'false');
    }

    if (chevron) {
        chevron.classList.toggle('rotate-180', isCurrentlyHidden);
    }

    // If expanding Ollama, fetch models
    if (providerId === 'ollama' && isCurrentlyHidden) {
        const permKey = isOllamaCloudMode() ? 'ollama-cloud' : 'ollama';
        const origins = OPTIONAL_HOST_PERMISSIONS[permKey];
        let granted = await hasOptionalHostPermissions(origins);
        if (!granted) {
            granted = await requestOptionalHostPermissions(origins);
        }
        if (!granted) {
            setOllamaModelSelectStatus('Permission required to load models');
            return;
        }
        await fetchOllamaModels();
    }
}

// Handle active provider dropdown change
async function handleActiveProviderChange(providerId) {
    // Sync the Ollama mode toggle when the dropdown changes
    if (providerId === 'ollama' || providerId === 'ollama-cloud') {
        setOllamaMode(providerId === 'ollama-cloud');
    }

    updateActiveProviderBadge(providerId);

    // Expand the selected provider's card if it's collapsed
    const cardId = getOllamaCardId(providerId);
    const body = document.querySelector(`[data-provider-body="${cardId}"]`);
    if (body && body.classList.contains('hidden')) {
        await toggleProviderCard(cardId);
    }
}

function setupKeyVisibilityToggles() {
    const toggles = document.querySelectorAll('[data-toggle-visibility]');
    toggles.forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const inputId = toggle.getAttribute('data-toggle-visibility');
            const input = document.getElementById(inputId);
            if (!input) return;

            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggle.textContent = isPassword ? 'Hide' : 'Show';
            toggle.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        });
    });
}

// Save settings to Browser storage
async function saveSettings() {
    const rawProviderSelection = document.getElementById('active-provider').value; // Can be empty string for "None"
    const providerSelection = resolveOllamaProvider(rawProviderSelection);
    // Prompt customization
    const promptCustomization = document.getElementById('prompt-customization').checked;
    const systemPrompt = document.getElementById('system-prompt').value;
    const userPrompt = document.getElementById('user-prompt').value;
    const settings = {
        serverCacheEnabled: document.getElementById('hn-companion-server-enabled').checked,
        providerSelection,
        ollama: {
            cloud: isOllamaCloudMode(),
            url: document.getElementById('ollama-url').value.replace(/\/+$/, '') || DEFAULT_OLLAMA_URL,
            apiKey: document.getElementById('ollama-key').value,
            model: document.getElementById('ollama-model').value
        },
        google: {
            apiKey: document.getElementById('google-key').value,
            model: document.getElementById('google-model').value
        },
        anthropic: {
            apiKey: document.getElementById('anthropic-key').value,
            model: document.getElementById('anthropic-model').value
        },
        openai: {
            apiKey: document.getElementById('openai-key').value,
            model: document.getElementById('openai-model').value
        },
        openrouter: {
            apiKey: document.getElementById('openrouter-key').value,
            model: document.getElementById('openrouter-model').value
        },
        promptCustomization,
        systemPrompt: promptCustomization ? systemPrompt : undefined,
        userPrompt: promptCustomization ? userPrompt : undefined
    };

    try {
        // Note: Permission request is now handled in the form submit handler
        // to preserve user gesture context for Firefox compatibility.
        await storage.setItem('sync:settings', settings);

        const saveButton = document.querySelector('button[type="submit"]');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Saved!';
        setTimeout(() => {
            saveButton.textContent = originalText;
        }, 2000);
    } catch (error) {
        await Logger.error('Error saving settings:', error);
    }
}

// Fetch Ollama models from API
async function fetchOllamaModels() {
    try {
        const ollamaUrl = getOllamaEffectiveUrl();
        const selectElement = document.getElementById('ollama-model');

        // Remember current selection before clearing
        const currentSelection = selectElement.value;

        const fetchOptions = {
            url: `${ollamaUrl}/api/tags`,
            method: 'GET',
            isErrorExpected: true
        };
        const extraHeaders = getOllamaFetchHeaders();
        if (Object.keys(extraHeaders).length > 0) {
            fetchOptions.headers = extraHeaders;
        }

        const data = await sendBackgroundMessage('FETCH_API_REQUEST', fetchOptions);

        // Clear existing options
        selectElement.options.length = 0

        // If no models found, add a placeholder option
        if (data.models.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models available';
            selectElement.appendChild(option);
        }
        else {
            const models = data.models.map(m => m.name).sort();

            if (isOllamaCloudMode()) {
                const grouped = new Map();
                for (const name of models) {
                    const slashIdx = name.indexOf('/');
                    const provider = slashIdx > 0 ? name.substring(0, slashIdx) : 'ollama';
                    const modelName = slashIdx > 0 ? name.substring(slashIdx + 1) : name;
                    if (!grouped.has(provider)) grouped.set(provider, []);
                    grouped.get(provider).push({ value: name, label: modelName });
                }
                const sortedProviders = [...grouped.keys()].sort();
                for (const provider of sortedProviders) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = provider;
                    for (const model of grouped.get(provider)) {
                        const option = document.createElement('option');
                        option.value = model.value;
                        option.textContent = model.label;
                        optgroup.appendChild(option);
                    }
                    selectElement.appendChild(optgroup);
                }
            } else {
                for (const name of models) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    selectElement.appendChild(option);
                }
            }

            // Restore selection: prefer current selection, fall back to saved settings
            const settings = await storage.getItem('sync:settings');
            const savedModel = settings?.ollama?.model;
            const modelToSelect = currentSelection || savedModel;

            if (modelToSelect) {
                const optionExists = Array.from(selectElement.options).some(opt => opt.value === modelToSelect);
                if (optionExists) {
                    selectElement.value = modelToSelect;
                }
            }
        }
    } catch (error) {
        await Logger.debug('Could not fetch Ollama models:', error.message);
        const selectElement = document.getElementById('ollama-model');
        selectElement.options.length = 0;

        const option = document.createElement('option');
        option.value = '';
        option.textContent = error.message?.includes('403')
            ? 'CORS blocked — see setup guide above'
            : 'Ollama not running';
        selectElement.appendChild(option);
    }
}

// Load settings from browser storage
async function loadSettings() {
    try {
        const settings = await storage.getItem('sync:settings');
        const systemPromptTextarea = document.getElementById('system-prompt');
        const userPromptTextarea = document.getElementById('user-prompt');
        const promptCustomizationCheckbox = document.getElementById('prompt-customization');

        if (settings) {
            // Set HN Companion Server enabled state
            if(settings.serverCacheEnabled !== undefined) {
                document.getElementById('hn-companion-server-enabled').checked = settings.serverCacheEnabled;
            }
            // Set provider selection in dropdown (can be empty string for "None")
            const providerDropdown = document.getElementById('active-provider');
            if (providerDropdown && settings.providerSelection !== undefined) {
                const dropdownValue = (settings.providerSelection === 'ollama' && settings.ollama?.cloud)
                    ? 'ollama-cloud'
                    : settings.providerSelection;
                providerDropdown.value = dropdownValue;
            }
            const badgeValue = (settings.providerSelection === 'ollama' && settings.ollama?.cloud)
                ? 'ollama-cloud'
                : (settings.providerSelection ?? '');
            updateActiveProviderBadge(badgeValue);

            // Set Ollama settings
            if (settings.ollama) {
                setOllamaMode(settings.ollama.cloud || false);
                document.getElementById('ollama-url').value = settings.ollama.url || DEFAULT_OLLAMA_URL;
                document.getElementById('ollama-key').value = settings.ollama.apiKey || '';
                if (settings.ollama.model) {
                    document.getElementById('ollama-model').value = settings.ollama.model;
                }
            }

            // Set Google settings
            if (settings.google) {
                document.getElementById('google-key').value = settings.google.apiKey || '';
                document.getElementById('google-model').value = settings.google.model || 'gemini-2.5-pro';
            }

            // Set Anthropic settings
            if (settings.anthropic) {
                document.getElementById('anthropic-key').value = settings.anthropic.apiKey || '';
                document.getElementById('anthropic-model').value = settings.anthropic.model || 'claude-opus-4-1';
            }

            // Set OpenAI settings
            if (settings.openai) {
                document.getElementById('openai-key').value = settings.openai.apiKey || '';
                document.getElementById('openai-model').value = settings.openai.model || 'gpt-5';
            }

            // Set OpenRouter settings
            if (settings.openrouter) {
                document.getElementById('openrouter-key').value = settings.openrouter.apiKey || '';
                document.getElementById('openrouter-model').value = settings.openrouter.model || 'deepseek/deepseek-chat';
            }

            // Prompt customization
            const promptCustomization = settings?.promptCustomization || false;
            promptCustomizationCheckbox.checked = promptCustomization;
            if (promptCustomization) {
                systemPromptTextarea.value = settings?.systemPrompt || AI_SYSTEM_PROMPT;
                userPromptTextarea.value = settings?.userPrompt || AI_USER_PROMPT_STRING;
            } else {
                systemPromptTextarea.value = AI_SYSTEM_PROMPT;
                userPromptTextarea.value = AI_USER_PROMPT_STRING;
            }
            setPromptCustomizationState(promptCustomization);
        } else {
            // First-time user: set defaults explicitly
            const providerDropdown = document.getElementById('active-provider');
            if (providerDropdown) {
                providerDropdown.value = ''; // None
            }
            updateActiveProviderBadge('');

            systemPromptTextarea.value = AI_SYSTEM_PROMPT;
            userPromptTextarea.value = AI_USER_PROMPT_STRING;
            promptCustomizationCheckbox.checked = false;
            setPromptCustomizationState(false);
        }
    } catch (error) {
        await Logger.error('Error loading settings:', error);
    }
}

// Initialize event listeners and load settings
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved settings
    await loadSettings();

    // Only attempt to load Ollama models if permission is already granted
    const ollamaPermKey = isOllamaCloudMode() ? 'ollama-cloud' : 'ollama';
    if (await hasOptionalHostPermissions(OPTIONAL_HOST_PERMISSIONS[ollamaPermKey])) {
        await fetchOllamaModels();
    } else {
        setOllamaModelSelectStatus('Expand to load models');
    }

    // Add save button event listener
    const form = document.querySelector('form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // IMPORTANT: Firefox loses "user action handler" status after any await.
        // permissions.request() MUST be the FIRST await to preserve user gesture context.
        // See: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/User_actions

        // 1. Determine provider selection SYNCHRONOUSLY (no await before permissions.request)
        const providerSelection = document.getElementById('active-provider').value; // Can be empty for "None"

        // 2. Request permission FIRST (MUST be first await to preserve user gesture in Firefox)
        const permKey = providerSelection === 'ollama-cloud' ? 'ollama-cloud' : providerSelection;
        const origins = OPTIONAL_HOST_PERMISSIONS[permKey] || [];
        if (origins.length > 0) {
            const permissionGranted = await requestOptionalHostPermissions(origins);
            if (!permissionGranted) {
                window.alert('Permission was not granted. Requests to the selected AI provider may fail until you allow access.');
            }
        }

        // 3. Now proceed with saving (user gesture no longer needed for storage operations)
        await saveSettings();
    });

    // Add cancel button event listener
    const cancelButton = document.getElementById('cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            window.close();
        });
    }

    // Add dropdown change listener for active provider selection
    const activeProviderDropdown = document.getElementById('active-provider');
    if (activeProviderDropdown) {
        activeProviderDropdown.addEventListener('change', async () => {
            await handleActiveProviderChange(activeProviderDropdown.value);
        });
    }

    // Add provider toggle buttons to expand/collapse provider settings
    const providerToggles = document.querySelectorAll('[data-provider-toggle]');
    providerToggles.forEach((toggle) => {
        toggle.addEventListener('click', async () => {
            const providerId = toggle.getAttribute('data-provider-toggle');
            await toggleProviderCard(providerId);
        });
    });

    // Add click listeners to provider card headers to expand/collapse
    const providerCards = document.querySelectorAll('[data-provider-card]');
    providerCards.forEach((card) => {
        card.addEventListener('click', async (e) => {
            // Prevent triggering if clicking on inputs, buttons, links, details, or the body
            if (e.target.closest('input, button, a, details, summary, select, textarea, [data-provider-body]')) {
                return;
            }
            const providerId = card.getAttribute('data-provider-card');
            await toggleProviderCard(providerId);
        });
    });

    // Add event listener for prompt customization checkbox
    const promptCustomizationCheckbox = document.getElementById('prompt-customization');
    promptCustomizationCheckbox.addEventListener('change', (e) => {
        setPromptCustomizationState(e.target.checked);
    });

    // Ollama local/cloud mode toggle buttons — sync with active provider dropdown
    const syncDropdownToOllamaMode = (isCloud) => {
        const dropdown = document.getElementById('active-provider');
        const currentIsOllama = dropdown.value === 'ollama' || dropdown.value === 'ollama-cloud';
        if (currentIsOllama) {
            dropdown.value = isCloud ? 'ollama-cloud' : 'ollama';
            updateActiveProviderBadge(dropdown.value);
        }
    };

    document.getElementById('ollama-mode-local').addEventListener('click', () => {
        setOllamaMode(false);
        syncDropdownToOllamaMode(false);
        fetchOllamaModels();
    });
    document.getElementById('ollama-mode-cloud').addEventListener('click', async () => {
        setOllamaMode(true);
        syncDropdownToOllamaMode(true);
        const origins = OPTIONAL_HOST_PERMISSIONS['ollama-cloud'];
        let granted = await hasOptionalHostPermissions(origins);
        if (!granted) {
            granted = await requestOptionalHostPermissions(origins);
        }
        if (granted) {
            await fetchOllamaModels();
        } else {
            setOllamaModelSelectStatus('Permission required to load models');
        }
    });

    setupKeyVisibilityToggles();

    // Set initial active provider badge state (can be empty for "None")
    const activeProvider = document.getElementById('active-provider').value;
    updateActiveProviderBadge(activeProvider);
});
