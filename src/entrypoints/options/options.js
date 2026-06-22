import './options.css';
import '@tailwindplus/elements';
import {AI_SYSTEM_PROMPT, AI_USER_PROMPT_STRING} from '../content/constants.js';
import {browser} from "wxt/browser";
import {storage} from '#imports';
import {Logger} from "../../lib/utils.js";
import {sendBackgroundMessage} from "../../lib/messaging.js";

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_CLOUD_URL = 'https://ollama.com';

const OPENAI_COMPATIBLE_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// OpenAI-compatible service presets. Selecting one pre-fills the base URL and
// whether an API key is expected. 'custom' lets the user point at a supported
// local or hosted endpoint from OPENAI_COMPATIBLE_PERMISSION_ORIGINS.
const OPENAI_COMPATIBLE_PRESETS = {
    openrouter: {
        baseURL: OPENAI_COMPATIBLE_OPENROUTER_BASE_URL,
        keyRequired: true,
        modelPlaceholder: 'e.g. deepseek/deepseek-chat',
        keyHelp: '🔑 Get your API key from <a href="https://openrouter.ai/settings/keys" target="_blank" class="underline">openrouter.ai</a> and browse models <a href="https://openrouter.ai/models" target="_blank" class="underline">here</a>.',
    },
    groq: {
        baseURL: 'https://api.groq.com/openai/v1',
        keyRequired: true,
        modelPlaceholder: 'e.g. llama-3.3-70b-versatile',
        keyHelp: '🔑 Get your API key from <a href="https://console.groq.com/keys" target="_blank" class="underline">console.groq.com</a>.',
    },
    together: {
        baseURL: 'https://api.together.ai/v1',
        keyRequired: true,
        modelPlaceholder: 'e.g. meta-llama/Llama-3.3-70B-Instruct-Turbo',
        keyHelp: '🔑 Get your API key from <a href="https://api.together.ai/settings/api-keys" target="_blank" class="underline">together.ai</a>.',
    },
    custom: {
        baseURL: '',
        keyRequired: false,
        modelPlaceholder: 'model identifier',
        keyHelp: '🔑 Enter the API key if your endpoint requires one. Local servers (llama.cpp, LM Studio) usually need none.',
    },
};

const OPENAI_COMPATIBLE_PERMISSION_ORIGINS = [
    'https://openrouter.ai/*',
    'https://api.groq.com/*',
    'https://api.together.ai/*',
    'https://api.together.xyz/*',
    'https://api.fireworks.ai/*',
    'https://api.deepinfra.com/*',
    'https://api.mistral.ai/*',
    'https://api.cerebras.ai/*',
    'https://api.perplexity.ai/*',
    'https://api.x.ai/*',
    'https://api.novita.ai/*',
    'https://api.sambanova.ai/*',
    'https://api.z.ai/*',
    'https://api.tokenrouter.com/*',
    'http://localhost/*',
    'http://127.0.0.1/*',
];

const OPTIONAL_HOST_PERMISSIONS = {
    openai: ['https://api.openai.com/*'],
    anthropic: ['https://api.anthropic.com/*'],
    google: ['https://generativelanguage.googleapis.com/*'],
    ollama: ['http://localhost/*'],
    'ollama-cloud': ['https://ollama.com/*'],
};

const PROVIDER_INPUT_SELECTORS = {
    google: ['#google-key', '#google-model'],
    anthropic: ['#anthropic-key', '#anthropic-model'],
    openai: ['#openai-key', '#openai-model'],
    'openai-compatible': ['#oaicompat-preset', '#oaicompat-url', '#oaicompat-key', '#oaicompat-model'],
    ollama: ['#ollama-url', '#ollama-model', '#ollama-key', '#ollama-cloud'],
    'ollama-cloud': ['#ollama-url', '#ollama-model', '#ollama-key', '#ollama-cloud'],
};

// Derive an optional-permission origin pattern (e.g. "https://api.groq.com/*")
// from a base URL. Returns null if the URL can't be parsed.
function originPatternFromUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        // Extension match patterns don't include ports; omitting the port also
        // lets one localhost permission cover LM Studio, llama.cpp, vLLM, etc.
        return `${parsed.protocol}//${parsed.hostname}/*`;
    } catch {
        return null;
    }
}

function getOpenAICompatibleOriginPattern() {
    return originPatternFromUrl(document.getElementById('oaicompat-url').value.trim());
}

function isSupportedOpenAICompatibleOrigin(pattern) {
    return OPENAI_COMPATIBLE_PERMISSION_ORIGINS.includes(pattern);
}

// Resolve the host-permission origins needed for the active provider, including
// the dynamic origin for a user-supplied OpenAI-compatible base URL.
function getProviderPermissionOrigins(providerId) {
    if (providerId === 'openai-compatible') {
        const pattern = getOpenAICompatibleOriginPattern();
        return pattern && isSupportedOpenAICompatibleOrigin(pattern) ? [pattern] : [];
    }
    return OPTIONAL_HOST_PERMISSIONS[providerId] || [];
}

function resolveOllamaProvider(providerId) {
    return providerId === 'ollama-cloud' ? 'ollama' : providerId;
}

function getOllamaCardId(providerId) {
    return (providerId === 'ollama' || providerId === 'ollama-cloud') ? 'ollama' : providerId;
}

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

// Set a <select> to a saved value, falling back to `fallback` when the saved
// value is no longer an available option (e.g. a now-deprecated model ID).
function setSelectValueWithFallback(selectId, savedValue, fallback) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.value = savedValue || fallback;
    if (select.selectedIndex === -1) {
        select.value = fallback;
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

// Apply an OpenAI-compatible preset to the form: fill the base URL (and lock it
// for known services), update the key hint, and refresh the model placeholder.
// When `fillUrl` is false the existing URL value is preserved (used on load).
function applyOpenAICompatiblePreset(presetId, fillUrl = true) {
    const preset = OPENAI_COMPATIBLE_PRESETS[presetId] || OPENAI_COMPATIBLE_PRESETS.custom;
    const isCustom = presetId === 'custom';

    const urlInput = document.getElementById('oaicompat-url');
    const modelInput = document.getElementById('oaicompat-model');
    const keyInput = document.getElementById('oaicompat-key');
    const keyHelp = document.getElementById('oaicompat-key-help');
    const urlHint = document.getElementById('oaicompat-url-hint');

    if (urlInput) {
        if (fillUrl && !isCustom) {
            urlInput.value = preset.baseURL;
        }
        // Known services have a fixed endpoint; only Custom is editable.
        urlInput.disabled = !isCustom;
    }
    if (urlHint) {
        urlHint.classList.toggle('hidden', !isCustom);
    }
    if (modelInput) {
        modelInput.placeholder = preset.modelPlaceholder;
    }
    if (keyInput) {
        keyInput.placeholder = preset.keyRequired ? 'Enter API key' : 'API key (optional for local servers)';
    }
    if (keyHelp) {
        keyHelp.innerHTML = preset.keyHelp;
    }
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

    const cardProviders = ['ollama', 'google', 'anthropic', 'openai', 'openai-compatible'];
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
    const openAICompatibleSettings = {
        preset: document.getElementById('oaicompat-preset').value,
        baseURL: document.getElementById('oaicompat-url').value.trim().replace(/\/+$/, ''),
        apiKey: document.getElementById('oaicompat-key').value,
        model: document.getElementById('oaicompat-model').value.trim()
    };
    const providerSelection = (rawProviderSelection === 'openai-compatible' && openAICompatibleSettings.preset === 'openrouter')
        ? 'openrouter'
        : resolveOllamaProvider(rawProviderSelection);
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
        'openai-compatible': openAICompatibleSettings,
        promptCustomization,
        systemPrompt: promptCustomization ? systemPrompt : undefined,
        userPrompt: promptCustomization ? userPrompt : undefined
    };

    // Transitional compatibility for synced settings: older builds only know
    // the OpenRouter provider id and settings key. This is only correct for the
    // OpenRouter preset; other OpenAI-compatible endpoints cannot work on old builds.
    if (openAICompatibleSettings.preset === 'openrouter') {
        settings.openrouter = {
            apiKey: openAICompatibleSettings.apiKey,
            model: openAICompatibleSettings.model
        };
    }

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
            // Map a stored providerSelection to the dropdown's option value.
            // 'openrouter' is the legacy id that is now folded into 'openai-compatible'.
            const toDropdownValue = (selection) => {
                if (selection === 'ollama' && settings.ollama?.cloud) return 'ollama-cloud';
                if (selection === 'openrouter') return 'openai-compatible';
                return selection ?? '';
            };

            // Set provider selection in dropdown (can be empty string for "None")
            const providerDropdown = document.getElementById('active-provider');
            if (providerDropdown && settings.providerSelection !== undefined) {
                providerDropdown.value = toDropdownValue(settings.providerSelection);
            }
            updateActiveProviderBadge(toDropdownValue(settings.providerSelection));

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
                setSelectValueWithFallback('google-model', settings.google.model, 'gemini-3.5-flash');
            }

            // Set Anthropic settings
            if (settings.anthropic) {
                document.getElementById('anthropic-key').value = settings.anthropic.apiKey || '';
                setSelectValueWithFallback('anthropic-model', settings.anthropic.model, 'claude-opus-4-8');
            }

            // Set OpenAI settings
            if (settings.openai) {
                document.getElementById('openai-key').value = settings.openai.apiKey || '';
                setSelectValueWithFallback('openai-model', settings.openai.model, 'gpt-5.5');
            }

            // Set OpenAI-compatible settings, migrating from the legacy 'openrouter'
            // settings shape if the new key isn't present yet.
            const compat = settings['openai-compatible']
                || (settings.openrouter
                    ? {
                        preset: 'openrouter',
                        baseURL: OPENAI_COMPATIBLE_PRESETS.openrouter.baseURL,
                        apiKey: settings.openrouter.apiKey,
                        model: settings.openrouter.model,
                    }
                    : null);
            if (compat) {
                const presetId = OPENAI_COMPATIBLE_PRESETS[compat.preset] ? compat.preset : 'custom';
                document.getElementById('oaicompat-preset').value = presetId;
                document.getElementById('oaicompat-url').value = compat.baseURL || OPENAI_COMPATIBLE_PRESETS[presetId].baseURL || '';
                document.getElementById('oaicompat-key').value = compat.apiKey || '';
                document.getElementById('oaicompat-model').value = compat.model || '';
                // Refresh placeholders/hints/lock state without overwriting the saved URL.
                applyOpenAICompatiblePreset(presetId, false);
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

        if (providerSelection === 'openai-compatible') {
            const pattern = getOpenAICompatibleOriginPattern();
            if (!pattern) {
                window.alert('Enter a valid http(s) Base URL for the OpenAI-compatible provider before saving.');
                return;
            }
            if (!isSupportedOpenAICompatibleOrigin(pattern)) {
                window.alert('That OpenAI-compatible endpoint is not in HN Companion’s supported endpoint list. Use a supported hosted provider or a localhost / 127.0.0.1 endpoint.');
                return;
            }
        }

        // 2. Request permission FIRST (MUST be first await to preserve user gesture in Firefox)
        const origins = getProviderPermissionOrigins(providerSelection);
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

    // OpenAI-compatible preset selector — fill base URL and update hints on change.
    const oaiCompatPreset = document.getElementById('oaicompat-preset');
    if (oaiCompatPreset) {
        oaiCompatPreset.addEventListener('change', () => {
            applyOpenAICompatiblePreset(oaiCompatPreset.value, true);
        });
    }

    setupKeyVisibilityToggles();

    // Set initial active provider badge state (can be empty for "None")
    const activeProvider = document.getElementById('active-provider').value;
    updateActiveProviderBadge(activeProvider);

    // Ensure the OpenAI-compatible card has correct URL/lock/placeholder state.
    // Fill the preset's base URL only when nothing was loaded (first-time users).
    const oaiPresetEl = document.getElementById('oaicompat-preset');
    if (oaiPresetEl) {
        const urlEmpty = !document.getElementById('oaicompat-url').value;
        applyOpenAICompatiblePreset(oaiPresetEl.value, urlEmpty);
    }
});
