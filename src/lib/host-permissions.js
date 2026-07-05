// Single source of truth for optional host permissions. The manifest's
// optional_host_permissions (wxt.config.ts) is derived from these lists;
// permissions.request() fails at runtime for any origin not declared there,
// so additions belong here, not in the config or the options page.

// Origins needed by the dedicated provider cards in the options page.
export const OPTIONAL_HOST_PERMISSIONS = {
    openai: ['https://api.openai.com/*'],
    anthropic: ['https://api.anthropic.com/*'],
    google: ['https://generativelanguage.googleapis.com/*'],
    ollama: ['http://localhost/*'],
    'ollama-cloud': ['https://ollama.com/*'],
};

// Endpoints accepted for the OpenAI-compatible provider (presets + custom).
export const OPENAI_COMPATIBLE_PERMISSION_ORIGINS = [
    'https://openrouter.ai/*',
    'https://api.groq.com/*',
    'https://api.together.ai/*',
    'https://api.fireworks.ai/*',
    'https://api.deepinfra.com/*',
    'https://api.mistral.ai/*',
    'https://api.cerebras.ai/*',
    'https://api.perplexity.ai/*',
    'https://api.x.ai/*',
    'https://api.z.ai/*',
    'https://api.tokenrouter.com/*',
    'https://api.deepseek.com/*',
    'https://api.cohere.ai/*',
    'https://api.cloudflare.com/*',
    'https://router.huggingface.co/*',
    'https://ai-gateway.vercel.sh/*',
    'http://host.docker.internal/*',
    'http://localhost/*',
    'http://127.0.0.1/*',
];

export const ALL_OPTIONAL_HOST_PERMISSIONS = [...new Set([
    ...Object.values(OPTIONAL_HOST_PERMISSIONS).flat(),
    ...OPENAI_COMPATIBLE_PERMISSION_ORIGINS,
])];

// Derive an optional-permission origin pattern (e.g. "https://api.groq.com/*")
// from a base URL. Returns null if the URL can't be parsed.
export function originPatternFromUrl(url) {
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

export function isSupportedOpenAICompatibleOrigin(pattern) {
    return OPENAI_COMPATIBLE_PERMISSION_ORIGINS.some((allowed) => {
        if (allowed === pattern) return true;
        // Wildcard-subdomain entries like https://*.oci.oraclecloud.com/*
        // cover any concrete host under that domain.
        const wildcard = allowed.match(/^(https?):\/\/\*\.([^/]+)\/\*$/);
        if (!wildcard) return false;
        const concrete = pattern.match(/^(https?):\/\/([^/]+)\/\*$/);
        return !!concrete
            && concrete[1] === wildcard[1]
            && (concrete[2] === wildcard[2] || concrete[2].endsWith(`.${wildcard[2]}`));
    });
}
