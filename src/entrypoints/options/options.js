// Save settings to Browser storage

async function saveSettings() {
    let providerSelection = 'google';
    if(document.querySelector('input[name="provider-selection"]:checked')?.id) {
        providerSelection = document.querySelector('input[name="provider-selection"]:checked').id;
    }
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
        }
    };

    try {
        await browser.storage.sync.set({ settings });

        const saveButton = document.querySelector('button[type="submit"]');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Saved!';
        setTimeout(() => {
            saveButton.textContent = originalText;
        }, 2000);
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

async function sendBackgroundMessage(type, data) {
    let response;
    try {
        response = await browser.runtime.sendMessage({type, data});
    } catch (error) {
        console.error(`Error sending browser runtime message ${type}:`, error);
        throw error;
    }

    if (!response) {
        console.error(`No response from background message ${type}`);
        throw new Error(`No response from background message ${type}`);
    }
    if (!response.success) {
        console.error(`Error response from background message ${type}:`, response.error);
        throw new Error(response.error);
    }

    return response.data;
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
        selectElement.innerHTML = '';

        // Add models to select element
        data.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            selectElement.appendChild(option);
        });

        // If no models found, add a placeholder option
        if (data.models.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models available';
            selectElement.appendChild(option);
        }
    } catch (error) {
        console.log('Error fetching Ollama models:', error);
        // Handle error by adding an error option
        const selectElement = document.getElementById('ollama-model');
        selectElement.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Error loading models';
        selectElement.appendChild(option);
    }
}

// Load settings from browser storage
async function loadSettings() {
    try {
        const data = await browser.storage.sync.get('settings');
        const settings = data.settings;

        if (settings) {
            // Set HN Companion Server enabled state
            if(settings.serverCacheEnabled !== undefined) {
                document.getElementById('hn-companion-server-enabled').checked = settings.serverCacheEnabled;
            }
            // Set provider selection
            const providerRadio = document.getElementById(settings.providerSelection);
            if (providerRadio) providerRadio.checked = true;

            // Set Ollama settings
            if (settings.ollama) {
                document.getElementById('ollama-model').value = settings.ollama.model || 'llama3.1';
            }

            // Set Google settings
            if (settings.google) {
                document.getElementById('google-key').value = settings.google.apiKey || '';
                document.getElementById('google-model').value = settings.google.model || 'gemini-2.0-flash';
            }

            // Set Anthropic settings
            if (settings.anthropic) {
                document.getElementById('anthropic-key').value = settings.anthropic.apiKey || '';
                document.getElementById('anthropic-model').value = settings.anthropic.model || 'claude-3-opus';
            }

            // Set OpenAI settings
            if (settings.openai) {
                document.getElementById('openai-key').value = settings.openai.apiKey || '';
                document.getElementById('openai-model').value = settings.openai.model || 'gpt-4';
            }

            // Set OpenRouter settings
            if (settings.openrouter) {
                document.getElementById('openrouter-key').value = settings.openrouter.apiKey || '';
                document.getElementById('openrouter-model').value = settings.openrouter.model || 'deepseek/deepseek-chat';
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Initialize event listeners and load settings
document.addEventListener('DOMContentLoaded', async () => {
    // Fetch Ollama models before loading other settings
    await fetchOllamaModels();

    // Load saved settings
    await loadSettings();

    // Add event listener for the server cache checkbox
    const serverCacheCheckbox = document.getElementById('hn-companion-server-enabled');
    serverCacheCheckbox.addEventListener('change', async (e) => {
        // Get the current state of the checkbox
        const isEnabled = e.target.checked;

        const currentSettings = await browser.storage.sync.get('settings');
        if (currentSettings && currentSettings.settings) {
            currentSettings.settings.serverCacheEnabled = isEnabled;
            await browser.storage.sync.set({settings: currentSettings.settings});
        }
    });

    // Add save button event listener
    const form = document.querySelector('form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });

    // Add cancel button event listener
    const cancelButton = document.querySelector('button[type="button"]');
    cancelButton.addEventListener('click', () => {
        window.close();
    });

    // Add radio button change listeners to enable/disable corresponding inputs
    const radioButtons = document.querySelectorAll('input[name="provider-selection"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            // Enable/disable input fields based on selection
            const openaiInputs = document.querySelectorAll('#openai-key, #openai-model');
            const anthropicInputs = document.querySelectorAll('#anthropic-key, #anthropic-model');
            const googleInputs = document.querySelectorAll('#google-key, #google-model');
            const ollamaInputs = document.querySelectorAll('#ollama-model');
            const openrouterInputs = document.querySelectorAll('#openrouter-key, #openrouter-model');

            openaiInputs.forEach(input => input.disabled = radio.id !== 'openai');
            anthropicInputs.forEach(input => input.disabled = radio.id !== 'anthropic');
            googleInputs.forEach(input => input.disabled = radio.id !== 'google');
            ollamaInputs.forEach(input => input.disabled = radio.id !== 'ollama');
            openrouterInputs.forEach(input => input.disabled = radio.id !== 'openrouter');
        });
    });

    // Initial trigger of radio button change event to set initial state
    const checkedRadio = document.querySelector('input[name="provider-selection"]:checked');
    if (checkedRadio) {
        checkedRadio.dispatchEvent(new Event('change'));
    }
});