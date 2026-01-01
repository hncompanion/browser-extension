import './options.css';
import '@tailwindplus/elements';
import {AI_SYSTEM_PROMPT, AI_USER_PROMPT_STRING} from '../content/constants.js';
import {browser} from "wxt/browser";
import {storage} from '#imports';
import {Logger} from "../../lib/utils.js";
import {sendBackgroundMessage} from "../../lib/messaging.js";

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
    ollama: ['#ollama-model'],
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

async function updateProviderSelection(providerId) {
    const activeProvider = PROVIDER_INPUT_SELECTORS[providerId] ? providerId : 'google';

    Object.entries(PROVIDER_INPUT_SELECTORS).forEach(([provider, selectors]) => {
        const isActive = provider === activeProvider;
        selectors.forEach((selector) => {
            const input = document.querySelector(selector);
            if (input) {
                input.disabled = !isActive;
            }
        });

        const card = document.querySelector(`[data-provider-card="${provider}"]`);
        const body = document.querySelector(`[data-provider-body="${provider}"]`);
        const chip = document.querySelector(`[data-provider-chip="${provider}"]`);
        const toggle = document.querySelector(`[data-provider-toggle="${provider}"]`);
        const chevron = document.querySelector(`[data-provider-chevron="${provider}"]`);

        if (card) {
            card.classList.toggle('ring-2', isActive);
            card.classList.toggle('ring-indigo-500/40', isActive);
            card.classList.toggle('bg-white/90', isActive);
            card.classList.toggle('dark:bg-gray-900/90', isActive);
        }

        if (body) {
            body.classList.toggle('hidden', !isActive);
        }

        if (chip) {
            chip.classList.toggle('hidden', !isActive);
        }

        if (toggle) {
            toggle.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        }

        if (chevron) {
            chevron.classList.toggle('rotate-180', isActive);
        }
    });

    if (activeProvider === 'ollama') {
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
    let providerSelection = 'google';
    if(document.querySelector('input[name="provider-selection"]:checked')?.id) {
        providerSelection = document.querySelector('input[name="provider-selection"]:checked').id;
    }
    // Prompt customization
    const promptCustomization = document.getElementById('prompt-customization').checked;
    const systemPrompt = document.getElementById('system-prompt').value;
    const userPrompt = document.getElementById('user-prompt').value;
    const settings = {
        serverCacheEnabled: document.getElementById('hn-companion-server-enabled').checked,
        providerSelection,
        ollama: {
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
        const origins = OPTIONAL_HOST_PERMISSIONS[providerSelection] || [];
        if (origins.length > 0) {
            const alreadyGranted = await hasOptionalHostPermissions(origins);
            if (!alreadyGranted) {
                const granted = await requestOptionalHostPermissions(origins);
                if (!granted) {
                    window.alert('Permission was not granted. Requests to the selected AI provider may fail until you allow access.');
                }
            }
        }

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
        const data = await sendBackgroundMessage('FETCH_API_REQUEST', {
            url: 'http://localhost:11434/api/tags',
            method: 'GET'
        });

        const selectElement = document.getElementById('ollama-model');
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
        }
    } catch (error) {
        await Logger.info('Error fetching Ollama models:', error);
        // Handle error by adding an error option
        const selectElement = document.getElementById('ollama-model');
        selectElement.options.length = 0

        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Error loading models';
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
            // Set provider selection
            const providerRadio = document.getElementById(settings.providerSelection);
            if (providerRadio)
                providerRadio.checked = true;

            // Set Ollama settings
            if (settings.ollama && settings.ollama.model) {
                document.getElementById('ollama-model').value = settings.ollama.model;
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
        setOllamaModelSelectStatus('Select Ollama to load models');
    }

    // Add save button event listener
    const form = document.querySelector('form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });

    // Add cancel button event listener
    const cancelButton = document.getElementById('cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            window.close();
        });
    }

    // Add radio button change listeners to enable/disable corresponding inputs
    const radioButtons = document.querySelectorAll('input[name="provider-selection"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', async () => {
            await updateProviderSelection(radio.id);
        });
    });

    // Add provider toggle buttons to select and expand providers
    const providerToggles = document.querySelectorAll('[data-provider-toggle]');
    providerToggles.forEach((toggle) => {
        toggle.addEventListener('click', async () => {
            const providerId = toggle.getAttribute('data-provider-toggle');
            const radio = document.getElementById(providerId);
            if (radio) {
                radio.checked = true;
                await updateProviderSelection(providerId);
            }
        });
    });

    // Add click listeners to provider cards to select that provider
    const providerCards = document.querySelectorAll('[data-provider-card]');
    providerCards.forEach((card) => {
        card.addEventListener('click', async (e) => {
            // Prevent triggering if clicking on inputs, buttons, links, or details
            if (e.target.closest('input, button, a, details, summary')) {
                return;
            }
            const providerId = card.getAttribute('data-provider-card');
            const radio = document.getElementById(providerId);
            if (radio) {
                radio.checked = true;
                await updateProviderSelection(providerId);
            }
        });
    });

    // Add event listener for prompt customization checkbox
    const promptCustomizationCheckbox = document.getElementById('prompt-customization');
    promptCustomizationCheckbox.addEventListener('change', (e) => {
        setPromptCustomizationState(e.target.checked);
    });

    setupKeyVisibilityToggles();

    // Initial trigger of radio button change event to set initial state
    const checkedRadio = document.querySelector('input[name="provider-selection"]:checked');
    if (checkedRadio) {
        await updateProviderSelection(checkedRadio.id);
    }
});
