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
    'https://api.novita.ai/*',
    'https://api.sambanova.ai/*',
    'https://api.z.ai/*',
    'https://api.tokenrouter.com/*',
    'https://api.deepseek.com/*',
    'https://api.cohere.ai/*',
    'https://api.cloudflare.com/*',
    'https://ai-gateway.vercel.sh/*',
    'https://*.oci.oraclecloud.com/*',
    'http://host.docker.internal/*',
    'http://localhost/*',
    'http://127.0.0.1/*',
];

export const ALL_OPTIONAL_HOST_PERMISSIONS = [...new Set([
    ...Object.values(OPTIONAL_HOST_PERMISSIONS).flat(),
    ...OPENAI_COMPATIBLE_PERMISSION_ORIGINS,
])];
