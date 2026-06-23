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

// Provider radio values used in the UI. Ollama is split into two cards
// (local + cloud) that both persist to the single `ollama` settings object,
// distinguished by the `cloud` flag.
const PROVIDER_LABELS = {
    'ollama': 'Ollama Local',
    'ollama-cloud': 'Ollama Cloud',
    'google': 'Google Gemini',
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'openai-compatible': 'OpenAI-compatible',
};

// Preserved across load/save so we can keep the Ollama cloud flag/model intact
// when neither Ollama card is the active provider.
let savedOllamaCloud = false;
let savedOllamaLocalModel = '';
let savedOllamaCloudModel = '';

const $ = (id) => document.getElementById(id);
const val = (id) => ($(id)?.value ?? '');

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
    return originPatternFromUrl(val('oaicompat-url').trim());
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

// Map a UI radio value to the stored providerSelection encoding.
function resolveOllamaProvider(providerId) {
    return providerId === 'ollama-cloud' ? 'ollama' : providerId;
}

// Map a stored providerSelection back to the UI radio value.
function toRadioValue(selection, ollamaCloud) {
    if (selection === 'openrouter') return 'openai-compatible';
    if (selection === 'ollama') return ollamaCloud ? 'ollama-cloud' : 'ollama';
    return selection || '';
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
    const select = $(selectId);
    if (!select) return;
    select.value = savedValue || fallback;
    if (select.selectedIndex === -1) {
        select.value = fallback;
    }
}

// Ensure a model value is present and selected in a model <select>, adding it as
// an option when missing (so a saved model shows before the live list loads).
function preselectModel(selectId, model) {
    if (!model) return;
    const select = $(selectId);
    if (!select) return;
    let option = Array.from(select.options).find((o) => o.value === model);
    if (!option) {
        option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        select.appendChild(option);
    }
    select.value = model;
}

function setOllamaModelSelectStatus(selectId, text) {
    const select = $(selectId);
    if (!select) return;
    select.options.length = 0;
    const option = document.createElement('option');
    option.value = '';
    option.textContent = text;
    select.appendChild(option);
}

function getSelectedProvider() {
    const checked = document.querySelector('input[name="provider"]:checked');
    return checked ? checked.value : '';
}

// Apply an OpenAI-compatible preset to the form: fill the base URL (and lock it
// for known services), update the key hint, and refresh the model placeholder.
// When `fillUrl` is false the existing URL value is preserved (used on load).
function applyOpenAICompatiblePreset(presetId, fillUrl = true) {
    const preset = OPENAI_COMPATIBLE_PRESETS[presetId] || OPENAI_COMPATIBLE_PRESETS.custom;
    const isCustom = presetId === 'custom';

    const urlInput = $('oaicompat-url');
    const modelInput = $('oaicompat-model');
    const keyInput = $('oaicompat-key');
    const keyHelp = $('oaicompat-key-help');
    const urlHint = $('oaicompat-url-hint');

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
    const systemPromptTextarea = $('system-prompt');
    const userPromptTextarea = $('user-prompt');
    const fields = $('prompt-customization-fields');

    if (fields) {
        fields.classList.toggle('opacity-60', !isEnabled);
    }
    [systemPromptTextarea, userPromptTextarea].forEach((textarea) => {
        if (!textarea) return;
        if (isEnabled) {
            textarea.removeAttribute('disabled');
            textarea.removeAttribute('readonly');
        } else {
            textarea.setAttribute('disabled', 'true');
            textarea.setAttribute('readonly', 'true');
        }
    });
}

// ---- Readiness / status -----------------------------------------------------

// Mirror of the downstream readiness rules (ai-summarizer.js): cloud key
// providers need an API key; openai-compatible needs a base URL + model (key
// optional); local Ollama needs a selected model (and a reachable server).
function getProviderConfig(provider) {
    switch (provider) {
        case 'google':
        case 'anthropic':
        case 'openai':
            return {configured: !!val(`${provider}-key`), missing: 'an API key'};
        case 'ollama-cloud':
            return {configured: !!val('ollama-key'), missing: 'an API key'};
        case 'ollama':
            return {configured: !!val('ollama-model'), missing: 'a running server and a selected model'};
        case 'openai-compatible': {
            const url = val('oaicompat-url').trim();
            const model = val('oaicompat-model').trim();
            return {configured: !!url && !!model, missing: !url ? 'a Base URL' : 'a model identifier'};
        }
        default:
            return {configured: false, missing: 'setup'};
    }
}

const BANNER_BASE = 'mb-4 flex items-center gap-2 rounded-lg border px-3.5 py-3 text-sm font-medium';
const BANNER_VARIANTS = {
    ready: {box: 'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200', dot: 'bg-emerald-500'},
    warn: {box: 'border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200', dot: 'bg-amber-500'},
    neutral: {box: 'border-gray-300/60 bg-gray-100 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300', dot: 'bg-gray-400'},
};

function setReadinessBanner(variant, message) {
    const banner = $('provider-readiness');
    const dot = $('provider-readiness-dot');
    const text = $('provider-readiness-text');
    if (!banner || !dot || !text) return;
    const v = BANNER_VARIANTS[variant];
    banner.className = `${BANNER_BASE} ${v.box}`;
    dot.className = `size-1.5 shrink-0 rounded-full ${v.dot}`;
    text.textContent = message;
}

const PILL_INDIGO = 'inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-200';
const PILL_NEUTRAL = 'inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20';

const STATUS_GREEN = 'inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300';
const STATUS_AMBER = 'inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300';

function updateActiveAndReadiness() {
    const generationEnabled = $('generation-enabled').checked;
    const provider = getSelectedProvider();
    const pill = $('active-provider-label');

    if (!generationEnabled) {
        pill.textContent = 'Off';
        pill.className = PILL_NEUTRAL;
        setReadinessBanner('neutral', 'Provider generation is off — only cached summaries will be shown.');
        return;
    }
    if (!provider) {
        pill.textContent = 'Active: None';
        pill.className = PILL_NEUTRAL;
        setReadinessBanner('warn', 'Choose a provider to generate summaries.');
        return;
    }
    const label = PROVIDER_LABELS[provider] || provider;
    pill.textContent = `Active: ${label}`;
    pill.className = PILL_INDIGO;

    const {configured, missing} = getProviderConfig(provider);
    if (configured) {
        setReadinessBanner('ready', 'Your active provider is configured and ready to generate summaries.');
    } else {
        setReadinessBanner('warn', `${label} needs ${missing} before it can generate summaries.`);
    }
}

function updateProviderBadges() {
    const selected = getSelectedProvider();
    Object.keys(PROVIDER_LABELS).forEach((provider) => {
        const {configured} = getProviderConfig(provider);
        const badge = document.querySelector(`[data-provider-status="${provider}"]`);
        if (badge) {
            if (configured) {
                badge.className = STATUS_GREEN;
                badge.textContent = 'Configured';
            } else {
                badge.className = STATUS_AMBER;
                badge.textContent = provider === 'ollama'
                    ? 'Needs local server'
                    : provider === 'openai-compatible' ? 'Needs setup' : 'Missing API key';
            }
        }

        const card = document.querySelector(`[data-provider-card="${provider}"]`);
        if (card) {
            const active = provider === selected;
            card.classList.toggle('ring-2', active);
            card.classList.toggle('ring-indigo-500/50', active);
            card.classList.toggle('border-indigo-300', active);
            card.classList.toggle('dark:border-indigo-500/40', active);
        }
    });
}

function updateGenerationCollapse() {
    const generationEnabled = $('generation-enabled').checked;
    $('gen-collapse').classList.toggle('hidden', !generationEnabled);
    $('gen-off-note').classList.toggle('hidden', generationEnabled);
}

function updateNoSummaryGuard() {
    const cacheOff = !$('hn-companion-server-enabled').checked;
    const generationOff = !$('generation-enabled').checked;
    const warning = $('no-summary-warning');
    const show = cacheOff && generationOff;
    warning.classList.toggle('hidden', !show);
    warning.classList.toggle('flex', show);
}

function refreshUI() {
    updateGenerationCollapse();
    updateNoSummaryGuard();
    updateProviderBadges();
    updateActiveAndReadiness();
}

// ---- Tabs -------------------------------------------------------------------

const TAB_ACTIVE = ['border-indigo-500', 'text-indigo-600', 'dark:border-indigo-400', 'dark:text-indigo-400'];
const TAB_INACTIVE = ['border-transparent', 'text-gray-500', 'hover:border-gray-300', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:border-white/20', 'dark:hover:text-gray-200'];

function switchTab(name) {
    document.querySelectorAll('[data-panel]').forEach((panel) => {
        const active = panel.getAttribute('data-panel') === name;
        panel.classList.toggle('hidden', !active);
        panel.toggleAttribute('hidden', !active);
    });
    document.querySelectorAll('[data-tab]').forEach((btn) => {
        const active = btn.getAttribute('data-tab') === name;
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.setAttribute('tabindex', active ? '0' : '-1');
        btn.classList.remove(...TAB_ACTIVE, ...TAB_INACTIVE);
        btn.classList.add(...(active ? TAB_ACTIVE : TAB_INACTIVE));
    });
}

function focusAdjacentTab(current, direction) {
    const tabs = Array.from(document.querySelectorAll('[data-tab]'));
    const currentIndex = tabs.indexOf(current);
    if (currentIndex === -1) return;
    const next = tabs[(currentIndex + direction + tabs.length) % tabs.length];
    next.focus();
    switchTab(next.getAttribute('data-tab'));
}

// ---- Provider card expand / selection --------------------------------------

async function toggleProviderCard(providerId) {
    const body = document.querySelector(`[data-provider-body="${providerId}"]`);
    const toggle = document.querySelector(`[data-provider-toggle="${providerId}"]`);
    const chevron = document.querySelector(`[data-provider-chevron="${providerId}"]`);
    if (!body) return;

    const willExpand = body.classList.contains('hidden');
    body.classList.toggle('hidden', !willExpand);
    if (toggle) toggle.setAttribute('aria-expanded', willExpand ? 'true' : 'false');
    if (chevron) chevron.classList.toggle('rotate-180', willExpand);

    if (willExpand && (providerId === 'ollama' || providerId === 'ollama-cloud')) {
        await ensureOllamaModels(providerId, {requestPermission: true});
    }
}

function selectProvider(value) {
    if (value) {
        const body = document.querySelector(`[data-provider-body="${value}"]`);
        if (body && body.classList.contains('hidden')) {
            void toggleProviderCard(value);
        }
    }
    updateProviderBadges();
    updateActiveAndReadiness();
}

function setupKeyVisibilityToggles() {
    document.querySelectorAll('[data-toggle-visibility]').forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const input = $(toggle.getAttribute('data-toggle-visibility'));
            if (!input) return;
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            toggle.textContent = isPassword ? 'Hide' : 'Show';
            toggle.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        });
    });
}

// ---- Ollama model fetching --------------------------------------------------

function getOllamaLocalUrl() {
    return val('ollama-url').replace(/\/+$/, '') || DEFAULT_OLLAMA_URL;
}

async function ensureOllamaModels(providerId, {requestPermission = false} = {}) {
    const isCloud = providerId === 'ollama-cloud';
    const permKey = isCloud ? 'ollama-cloud' : 'ollama';
    const selectId = isCloud ? 'ollama-cloud-model' : 'ollama-model';
    const origins = OPTIONAL_HOST_PERMISSIONS[permKey];

    // In Firefox, permissions.request() must be the first awaited call in a user
    // action. Expanding the Ollama cards is a user action, so request first
    // there. Background prefetch still uses contains() to avoid surprise prompts.
    const granted = requestPermission
        ? await requestOptionalHostPermissions(origins)
        : await hasOptionalHostPermissions(origins);

    if (!granted) {
        setOllamaModelSelectStatus(selectId, 'Permission required to load models');
        return;
    }
    await fetchOllamaModels(isCloud ? 'cloud' : 'local');
}

async function fetchOllamaModels(mode) {
    const isCloud = mode === 'cloud';
    const selectId = isCloud ? 'ollama-cloud-model' : 'ollama-model';
    const select = $(selectId);
    if (!select) return;
    const currentSelection = select.value;

    try {
        const url = isCloud ? OLLAMA_CLOUD_URL : getOllamaLocalUrl();
        const fetchOptions = {url: `${url}/api/tags`, method: 'GET', isErrorExpected: true};
        if (isCloud) {
            const apiKey = val('ollama-key');
            if (apiKey) fetchOptions.headers = {'Authorization': `Bearer ${apiKey}`};
        }

        const data = await sendBackgroundMessage('FETCH_API_REQUEST', fetchOptions);
        select.options.length = 0;

        if (!data.models || data.models.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models available';
            select.appendChild(option);
        } else {
            const models = data.models.map((m) => m.name).sort();
            if (isCloud) {
                const grouped = new Map();
                for (const name of models) {
                    const slashIdx = name.indexOf('/');
                    const provider = slashIdx > 0 ? name.substring(0, slashIdx) : 'ollama';
                    const modelName = slashIdx > 0 ? name.substring(slashIdx + 1) : name;
                    if (!grouped.has(provider)) grouped.set(provider, []);
                    grouped.get(provider).push({value: name, label: modelName});
                }
                for (const provider of [...grouped.keys()].sort()) {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = provider;
                    for (const model of grouped.get(provider)) {
                        const option = document.createElement('option');
                        option.value = model.value;
                        option.textContent = model.label;
                        optgroup.appendChild(option);
                    }
                    select.appendChild(optgroup);
                }
            } else {
                for (const name of models) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    select.appendChild(option);
                }
            }

            const savedModel = isCloud ? savedOllamaCloudModel : savedOllamaLocalModel;
            const modelToSelect = currentSelection || savedModel;
            if (modelToSelect && Array.from(select.options).some((opt) => opt.value === modelToSelect)) {
                select.value = modelToSelect;
            }
        }
    } catch (error) {
        await Logger.debug('Could not fetch Ollama models (Ollama may not be running):', error.message);
        setOllamaModelSelectStatus(selectId, isCloud ? 'Could not load models' : 'Ollama not running');
    }

    updateProviderBadges();
    updateActiveAndReadiness();
}

// ---- Save / Load ------------------------------------------------------------

async function saveSettings() {
    const generationEnabled = $('generation-enabled').checked;
    const rawSelection = getSelectedProvider();

    const openAICompatibleSettings = {
        preset: val('oaicompat-preset'),
        baseURL: val('oaicompat-url').trim().replace(/\/+$/, ''),
        apiKey: val('oaicompat-key'),
        model: val('oaicompat-model').trim(),
    };

    // Stored providerSelection always holds the picked provider (selection is
    // retained even when generation is off). 'openrouter' is the legacy alias
    // for the OpenRouter preset; ollama-cloud collapses to 'ollama' + flag.
    const providerSelection = (rawSelection === 'openai-compatible' && openAICompatibleSettings.preset === 'openrouter')
        ? 'openrouter'
        : resolveOllamaProvider(rawSelection);

    const ollamaCloud = rawSelection === 'ollama-cloud'
        ? true
        : (rawSelection === 'ollama' ? false : savedOllamaCloud);
    const ollamaLocalModel = val('ollama-model') || savedOllamaLocalModel;
    const ollamaCloudModel = val('ollama-cloud-model') || savedOllamaCloudModel;
    const ollamaModel = ollamaCloud ? ollamaCloudModel : ollamaLocalModel;

    const promptCustomization = $('prompt-customization').checked;
    const systemPrompt = val('system-prompt');
    const userPrompt = val('user-prompt');

    const settings = {
        serverCacheEnabled: $('hn-companion-server-enabled').checked,
        generationEnabled,
        providerSelection,
        ollama: {
            cloud: ollamaCloud,
            url: val('ollama-url').replace(/\/+$/, '') || DEFAULT_OLLAMA_URL,
            apiKey: val('ollama-key'),
            model: ollamaModel,
            localModel: ollamaLocalModel,
            cloudModel: ollamaCloudModel,
        },
        google: {apiKey: val('google-key'), model: val('google-model')},
        anthropic: {apiKey: val('anthropic-key'), model: val('anthropic-model')},
        openai: {apiKey: val('openai-key'), model: val('openai-model')},
        'openai-compatible': openAICompatibleSettings,
        promptCustomization,
        systemPrompt: promptCustomization ? systemPrompt : undefined,
        userPrompt: promptCustomization ? userPrompt : undefined,
    };

    // Transitional compatibility for synced settings: older builds only know the
    // OpenRouter provider id and settings key. Correct only for the OpenRouter
    // preset; other OpenAI-compatible endpoints can't work on old builds.
    if (openAICompatibleSettings.preset === 'openrouter') {
        settings.openrouter = {
            apiKey: openAICompatibleSettings.apiKey,
            model: openAICompatibleSettings.model,
        };
    }

    savedOllamaCloud = ollamaCloud;
    savedOllamaLocalModel = ollamaLocalModel;
    savedOllamaCloudModel = ollamaCloudModel;

    try {
        // Permission requests happen in the submit handler to preserve the user
        // gesture (Firefox requirement); storage writes don't need it.
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

async function loadSettings() {
    try {
        const settings = await storage.getItem('sync:settings');
        const systemPromptTextarea = $('system-prompt');
        const userPromptTextarea = $('user-prompt');
        const promptCustomizationCheckbox = $('prompt-customization');

        if (settings) {
            if (settings.serverCacheEnabled !== undefined) {
                $('hn-companion-server-enabled').checked = settings.serverCacheEnabled;
            }

            // Migration: derive generation enablement for settings saved before
            // `generationEnabled` existed (non-empty providerSelection => on).
            const generationEnabled = settings.generationEnabled ?? Boolean(settings.providerSelection);
            $('generation-enabled').checked = generationEnabled;

            savedOllamaCloud = settings.ollama?.cloud || false;

            // Restore the selected provider radio (retained even when off).
            const radioValue = toRadioValue(settings.providerSelection, savedOllamaCloud);
            if (radioValue) {
                const radio = $(`provider-${radioValue}`);
                if (radio) radio.checked = true;
            }

            if (settings.ollama) {
                $('ollama-url').value = settings.ollama.url || DEFAULT_OLLAMA_URL;
                $('ollama-key').value = settings.ollama.apiKey || '';
                // Keep separate local/cloud selections for the split cards while
                // preserving the legacy `model` value used by summarization.
                savedOllamaLocalModel = settings.ollama.localModel || (!savedOllamaCloud ? settings.ollama.model : '') || '';
                savedOllamaCloudModel = settings.ollama.cloudModel || (savedOllamaCloud ? settings.ollama.model : '') || '';
                preselectModel('ollama-model', savedOllamaLocalModel);
                preselectModel('ollama-cloud-model', savedOllamaCloudModel);
            }

            if (settings.google) {
                $('google-key').value = settings.google.apiKey || '';
                setSelectValueWithFallback('google-model', settings.google.model, 'gemini-3.5-flash');
            }
            if (settings.anthropic) {
                $('anthropic-key').value = settings.anthropic.apiKey || '';
                setSelectValueWithFallback('anthropic-model', settings.anthropic.model, 'claude-opus-4-8');
            }
            if (settings.openai) {
                $('openai-key').value = settings.openai.apiKey || '';
                setSelectValueWithFallback('openai-model', settings.openai.model, 'gpt-5.5');
            }

            // OpenAI-compatible, migrating from the legacy 'openrouter' shape.
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
                $('oaicompat-preset').value = presetId;
                $('oaicompat-url').value = compat.baseURL || OPENAI_COMPATIBLE_PRESETS[presetId].baseURL || '';
                $('oaicompat-key').value = compat.apiKey || '';
                $('oaicompat-model').value = compat.model || '';
                applyOpenAICompatiblePreset(presetId, false);
            }

            const promptCustomization = settings.promptCustomization || false;
            promptCustomizationCheckbox.checked = promptCustomization;
            systemPromptTextarea.value = (promptCustomization && settings.systemPrompt) || AI_SYSTEM_PROMPT;
            userPromptTextarea.value = (promptCustomization && settings.userPrompt) || AI_USER_PROMPT_STRING;
            setPromptCustomizationState(promptCustomization);
        } else {
            // First-time user: cache on, generation on, Google selected (matches
            // background DEFAULT_SETTINGS). Google has no key yet => "Missing API key".
            $('hn-companion-server-enabled').checked = true;
            $('generation-enabled').checked = true;
            const google = $('provider-google');
            if (google) google.checked = true;

            systemPromptTextarea.value = AI_SYSTEM_PROMPT;
            userPromptTextarea.value = AI_USER_PROMPT_STRING;
            promptCustomizationCheckbox.checked = false;
            setPromptCustomizationState(false);
        }
    } catch (error) {
        await Logger.error('Error loading settings:', error);
    }
}

// ---- Init -------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();

    // Ensure the OpenAI-compatible card has correct URL/lock/placeholder state
    // before computing readiness. Fill the preset's base URL only when nothing
    // was loaded (first-time users).
    const presetEl = $('oaicompat-preset');
    if (presetEl) {
        applyOpenAICompatiblePreset(presetEl.value, !val('oaicompat-url'));
    }

    switchTab('general');
    refreshUI();

    // Prefetch models for a pre-selected Ollama provider if permission is granted.
    const selected = getSelectedProvider();
    if (selected === 'ollama' && await hasOptionalHostPermissions(OPTIONAL_HOST_PERMISSIONS.ollama)) {
        await fetchOllamaModels('local');
    } else if (selected === 'ollama-cloud' && await hasOptionalHostPermissions(OPTIONAL_HOST_PERMISSIONS['ollama-cloud'])) {
        await fetchOllamaModels('cloud');
    }

    // Tabs
    document.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
        btn.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                focusAdjacentTab(btn, 1);
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                focusAdjacentTab(btn, -1);
            } else if (event.key === 'Home') {
                event.preventDefault();
                const first = document.querySelector('[data-tab]');
                if (first) {
                    first.focus();
                    switchTab(first.getAttribute('data-tab'));
                }
            } else if (event.key === 'End') {
                event.preventDefault();
                const tabs = document.querySelectorAll('[data-tab]');
                const last = tabs[tabs.length - 1];
                if (last) {
                    last.focus();
                    switchTab(last.getAttribute('data-tab'));
                }
            }
        });
    });

    // Server cache + generation master toggles
    $('hn-companion-server-enabled').addEventListener('change', updateNoSummaryGuard);
    $('generation-enabled').addEventListener('change', () => {
        updateGenerationCollapse();
        updateNoSummaryGuard();
        updateActiveAndReadiness();
    });

    // Provider radio selection
    document.querySelectorAll('input[name="provider"]').forEach((radio) => {
        radio.addEventListener('change', () => selectProvider(radio.value));
    });

    // Chevron buttons expand/collapse a card without changing selection
    document.querySelectorAll('[data-provider-toggle]').forEach((toggle) => {
        toggle.addEventListener('click', () => toggleProviderCard(toggle.getAttribute('data-provider-toggle')));
    });

    // Clicking a card body (outside controls) selects that provider
    document.querySelectorAll('[data-provider-card]').forEach((card) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button, a, details, summary, input, select, textarea, [data-provider-body]')) {
                return;
            }
            const value = card.getAttribute('data-provider-card');
            const radio = $(`provider-${value}`);
            if (radio && !radio.checked) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', {bubbles: true}));
            }
        });
    });

    // Config inputs that affect readiness/badges
    ['google-key', 'anthropic-key', 'openai-key', 'ollama-key', 'ollama-url',
        'ollama-model', 'ollama-cloud-model', 'oaicompat-url', 'oaicompat-model',
        'google-model', 'anthropic-model', 'openai-model'].forEach((id) => {
        const el = $(id);
        if (el) {
            el.addEventListener('input', () => {
                updateProviderBadges();
                updateActiveAndReadiness();
            });
            el.addEventListener('change', () => {
                updateProviderBadges();
                updateActiveAndReadiness();
            });
        }
    });

    // OpenAI-compatible preset selector
    if (presetEl) {
        presetEl.addEventListener('change', () => {
            applyOpenAICompatiblePreset(presetEl.value, true);
            updateProviderBadges();
            updateActiveAndReadiness();
        });
    }

    // Prompt customization toggle
    $('prompt-customization').addEventListener('change', (e) => {
        setPromptCustomizationState(e.target.checked);
    });

    setupKeyVisibilityToggles();

    // Save
    document.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();

        // Firefox loses user-gesture status after any await, so permissions.request()
        // MUST be the first await. Determine the selection synchronously first.
        const generationEnabled = $('generation-enabled').checked;
        const providerSelection = getSelectedProvider();

        if (generationEnabled && providerSelection === 'openai-compatible') {
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

        if (generationEnabled && providerSelection) {
            const origins = getProviderPermissionOrigins(providerSelection);
            if (origins.length > 0) {
                const granted = await requestOptionalHostPermissions(origins);
                if (!granted) {
                    window.alert('Permission was not granted. Requests to the selected AI provider may fail until you allow access.');
                }
            }
        }

        await saveSettings();
    });

    // Cancel
    const cancelButton = $('cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => window.close());
    }
});
