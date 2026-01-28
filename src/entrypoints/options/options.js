import './options.css';
import '@tailwindplus/elements';
import {AI_SYSTEM_PROMPT, AI_USER_PROMPT_STRING} from '../content/constants.js';
import {browser} from "wxt/browser";
import {storage} from '#imports';
import {Logger} from "../../lib/utils.js";
import {sendBackgroundMessage} from "../../lib/messaging.js";

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

const OPTIONAL_HOST_PERMISSIONS = {
    openai: ['https://api.openai.com/*'],
    anthropic: ['https://api.anthropic.com/*'],
    openrouter: ['https://openrouter.ai/*'],
    google: ['https://generativelanguage.googleapis.com/*'],
    ollama: ['http://localhost:11434/*'],
};

const PROVIDER_INPUT_SELECTORS = {
    google: ['#google-key', '#google-model'],
    anthropic: ['#anthropic-key', '#anthropic-model'],
    openai: ['#openai-key', '#openai-model'],
    openrouter: ['#openrouter-key', '#openrouter-model'],
    ollama: ['#ollama-url', '#ollama-model'],
};

async function hasOptionalHostPermissions(origins) {
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

    Object.keys(PROVIDER_INPUT_SELECTORS).forEach((provider) => {
        const isActive = provider === activeProvider;
        const chip = document.querySelector(`[data-provider-chip="${provider}"]`);
        const card = document.querySelector(`[data-provider-card="${provider}"]`);

        if (chip) {
            chip.classList.toggle('hidden', !isActive);
            chip.classList.toggle('inline-flex', isActive);
        }

        // Highlight the active provider's card
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
        const origins = OPTIONAL_HOST_PERMISSIONS.ollama;
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
    updateActiveProviderBadge(providerId);

    // Expand the selected provider's card if it's collapsed
    const body = document.querySelector(`[data-provider-body="${providerId}"]`);
    if (body && body.classList.contains('hidden')) {
        await toggleProviderCard(providerId);
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
    const providerSelection = document.getElementById('active-provider').value; // Can be empty string for "None"
    // Prompt customization
    const promptCustomization = document.getElementById('prompt-customization').checked;
    const systemPrompt = document.getElementById('system-prompt').value;
    const userPrompt = document.getElementById('user-prompt').value;
    const settings = {
        serverCacheEnabled: document.getElementById('hn-companion-server-enabled').checked,
        providerSelection,
        ollama: {
            url: document.getElementById('ollama-url').value.replace(/\/+$/, '') || DEFAULT_OLLAMA_URL,
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
        const ollamaUrl = document.getElementById('ollama-url').value.replace(/\/+$/, '') || DEFAULT_OLLAMA_URL;
        const selectElement = document.getElementById('ollama-model');
        
        // Remember current selection before clearing
        const currentSelection = selectElement.value;
        
        const data = await sendBackgroundMessage('FETCH_API_REQUEST', {
            url: `${ollamaUrl}/api/tags`,
            method: 'GET',
            isErrorExpected: true  // Ollama not running is expected, suppress error logs
        });

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
            // Add models to select element
            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                selectElement.appendChild(option);
            });

            // Restore selection: prefer current selection, fall back to saved settings
            const settings = await storage.getItem('sync:settings');
            const savedModel = settings?.ollama?.model;
            const modelToSelect = currentSelection || savedModel;
            
            if (modelToSelect) {
                // Check if the model exists in the options
                const optionExists = Array.from(selectElement.options).some(opt => opt.value === modelToSelect);
                if (optionExists) {
                    selectElement.value = modelToSelect;
                }
            }
        }
    } catch (error) {
        // Ollama not running is expected - user may not have started it yet
        // Only log at debug level to avoid noise
        await Logger.debug('Could not fetch Ollama models (Ollama may not be running):', error.message);
        // Handle error by adding a helpful status option
        const selectElement = document.getElementById('ollama-model');
        selectElement.options.length = 0

        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Ollama not running';
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
                providerDropdown.value = settings.providerSelection;
            }
            updateActiveProviderBadge(settings.providerSelection ?? '');

            // Set Ollama settings
            if (settings.ollama) {
                document.getElementById('ollama-url').value = settings.ollama.url || DEFAULT_OLLAMA_URL;
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
    if (await hasOptionalHostPermissions(OPTIONAL_HOST_PERMISSIONS.ollama)) {
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
        const origins = OPTIONAL_HOST_PERMISSIONS[providerSelection] || [];
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

    setupKeyVisibilityToggles();

    // Set initial active provider badge state (can be empty for "None")
    const activeProvider = document.getElementById('active-provider').value;
    updateActiveProviderBadge(activeProvider);
});
