// Hand-maintained catalog of OpenAI-compatible provider presets shown in the
// options page. `modelsDevId` links a preset to its models.dev entry, which
// scripts/providers.js uses to validate provider/model metadata in CI. Entries
// with `modelsDevId: null` are fully manual (not covered by models.dev).
//
// Every baseURL's origin must be covered by OPENAI_COMPATIBLE_PERMISSION_ORIGINS
// in host-permissions.js — scripts/providers.js and tests enforce this.
//
// Where models.dev publishes an `api` URL it is the source for baseURL
// (openrouter, fireworks, novita, zai, deepseek). The rest list only their
// AI SDK package there, so their OpenAI-compatible endpoints are maintained
// here and cross-checked against models.dev if it later publishes one.
//
// `suggestedModels` is intentionally curated rather than exhaustive: these are
// known chat/text-generation models suitable for HN summarization. The options
// page still accepts free-form model IDs.
export const OPENAI_COMPATIBLE_PROVIDERS = [
    {
        id: 'openrouter',
        label: 'OpenRouter',
        apiSurface: 'chat-completions',
        modelsDevId: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        keyRequired: true,
        keysUrl: 'https://openrouter.ai/settings/keys',
        docsUrl: 'https://openrouter.ai/models',
        suggestedModels: [
            {id: 'openrouter/fusion', name: 'Fusion', context: 1000000, output: 128000},
            {id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', context: 1000000, output: 128000},
            {id: 'moonshotai/kimi-k2.7-code', name: 'Kimi K2.7 Code', context: 262144, output: 16384},
        ],
    },
    {
        id: 'groq',
        label: 'Groq',
        apiSurface: 'chat-completions',
        modelsDevId: 'groq',
        baseURL: 'https://api.groq.com/openai/v1',
        keyRequired: true,
        keysUrl: 'https://console.groq.com/keys',
        docsUrl: 'https://console.groq.com/docs/models',
        suggestedModels: [
            {id: 'groq/compound', name: 'Compound', context: 131072, output: 8192},
            {id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', context: 131072, output: 32768},
            {id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', context: 131072, output: 131072},
        ],
    },
    {
        id: 'together',
        label: 'Together AI',
        apiSurface: 'chat-completions',
        modelsDevId: 'togetherai',
        baseURL: 'https://api.together.ai/v1',
        keyRequired: true,
        keysUrl: 'https://api.together.ai/settings/api-keys',
        docsUrl: 'https://docs.together.ai/docs/serverless-models',
        suggestedModels: [
            {id: 'Qwen/Qwen3.7-Max', name: 'Qwen3.7 Max', context: 1000000, output: 500000},
            {id: 'moonshotai/Kimi-K2.7-Code', name: 'Kimi K2.7 Code', context: 262144, output: 131072},
            {id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Instruct Turbo', context: 131072, output: 131072},
        ],
    },
    {
        id: 'fireworks',
        label: 'Fireworks AI',
        apiSurface: 'chat-completions',
        modelsDevId: 'fireworks-ai',
        baseURL: 'https://api.fireworks.ai/inference/v1',
        keyRequired: true,
        keysUrl: 'https://app.fireworks.ai/settings/users/api-keys',
        docsUrl: 'https://fireworks.ai/docs/',
        suggestedModels: [
            {id: 'accounts/fireworks/routers/glm-5p2-fast', name: 'GLM 5.2 Fast', context: 1048575, output: 131072},
            {id: 'accounts/fireworks/models/deepseek-v4-flash', name: 'DeepSeek V4 Flash', context: 1000000, output: 384000},
            {id: 'accounts/fireworks/routers/kimi-k2p7-code-fast', name: 'Kimi K2.7 Code Fast', context: 262000, output: 262000},
        ],
    },
    {
        id: 'deepinfra',
        label: 'DeepInfra',
        apiSurface: 'chat-completions',
        modelsDevId: 'deepinfra',
        baseURL: 'https://api.deepinfra.com/v1/openai',
        keyRequired: true,
        keysUrl: 'https://deepinfra.com/dash/api_keys',
        docsUrl: 'https://deepinfra.com/models',
        suggestedModels: [
            {id: 'zai-org/GLM-5.2', name: 'GLM-5.2', context: 1048576, output: 32768},
            {id: 'deepseek-ai/DeepSeek-V4-Flash', name: 'DeepSeek V4 Flash', context: 1048576, output: 16384},
            {id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', context: 131072, output: 16384},
        ],
    },
    {
        id: 'mistral',
        label: 'Mistral',
        apiSurface: 'chat-completions',
        modelsDevId: 'mistral',
        baseURL: 'https://api.mistral.ai/v1',
        keyRequired: true,
        keysUrl: 'https://console.mistral.ai/api-keys',
        docsUrl: 'https://docs.mistral.ai/getting-started/models/',
        suggestedModels: [
            {id: 'mistral-medium-latest', name: 'Mistral Medium', context: 262144, output: 262144},
            {id: 'mistral-small-latest', name: 'Mistral Small', context: 256000, output: 256000},
            {id: 'codestral-latest', name: 'Codestral', context: 256000, output: 4096},
        ],
    },
    {
        id: 'cerebras',
        label: 'Cerebras',
        apiSurface: 'chat-completions',
        modelsDevId: 'cerebras',
        baseURL: 'https://api.cerebras.ai/v1',
        keyRequired: true,
        keysUrl: 'https://cloud.cerebras.ai',
        docsUrl: 'https://inference-docs.cerebras.ai/models/overview',
        suggestedModels: [
            {id: 'zai-glm-4.7', name: 'Z.AI GLM-4.7', context: 131072, output: 40960},
            {id: 'gpt-oss-120b', name: 'GPT OSS 120B', context: 131072, output: 40960},
            {id: 'gemma-4-31b', name: 'Gemma 4 31B IT', context: 131072, output: 40960},
        ],
    },
    {
        id: 'perplexity',
        // models.dev also has 'perplexity-agent'; that is a different API
        // surface, not the OpenAI-compatible Chat Completions endpoint.
        label: 'Perplexity',
        apiSurface: 'chat-completions',
        modelsDevId: 'perplexity',
        baseURL: 'https://api.perplexity.ai',
        keyRequired: true,
        keysUrl: 'https://www.perplexity.ai/settings/api',
        docsUrl: 'https://docs.perplexity.ai/docs/sonar/openai-compatibility',
        suggestedModels: [
            {id: 'sonar-pro', name: 'Sonar Pro', context: 200000, output: 8192},
            {id: 'sonar', name: 'Sonar', context: 128000, output: 4096},
            {id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', context: 128000, output: 4096},
        ],
    },
    {
        id: 'xai',
        label: 'xAI (Grok)',
        apiSurface: 'chat-completions',
        modelsDevId: 'xai',
        baseURL: 'https://api.x.ai/v1',
        keyRequired: true,
        keysUrl: 'https://console.x.ai',
        docsUrl: 'https://docs.x.ai/docs/models',
        suggestedModels: [
            {id: 'grok-4.3', name: 'Grok 4.3', context: 1000000, output: 30000},
            {id: 'grok-4.20-0309-non-reasoning', name: 'Grok 4.20 Non-Reasoning', context: 1000000, output: 30000},
            {id: 'grok-4.20-0309-reasoning', name: 'Grok 4.20 Reasoning', context: 1000000, output: 30000},
        ],
    },
    {
        id: 'novita',
        label: 'Novita AI',
        apiSurface: 'chat-completions',
        modelsDevId: 'novita-ai',
        baseURL: 'https://api.novita.ai/openai',
        keyRequired: true,
        keysUrl: 'https://novita.ai/settings/key-management',
        docsUrl: 'https://novita.ai/docs/guides/introduction',
        suggestedModels: [
            {id: 'zai-org/glm-5.2', name: 'GLM-5.2', context: 1048576, output: 131072},
            {id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', context: 1048576, output: 393216},
            {id: 'inclusionai/ling-2.6-flash', name: 'Ling-2.6 Flash', context: 262144, output: 32768},
        ],
    },
    {
        id: 'zai',
        label: 'Z.AI',
        apiSurface: 'chat-completions',
        modelsDevId: 'zai',
        baseURL: 'https://api.z.ai/api/paas/v4',
        keyRequired: true,
        keysUrl: 'https://z.ai/manage-apikey/apikey-list',
        docsUrl: 'https://docs.z.ai/guides/overview/pricing',
        suggestedModels: [
            {id: 'glm-5.2', name: 'GLM-5.2', context: 1000000, output: 131072},
            {id: 'glm-5.1', name: 'GLM-5.1', context: 200000, output: 131072},
            {id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', context: 200000, output: 131072},
        ],
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        apiSurface: 'chat-completions',
        modelsDevId: 'deepseek',
        baseURL: 'https://api.deepseek.com',
        keyRequired: true,
        keysUrl: 'https://platform.deepseek.com/api_keys',
        docsUrl: 'https://api-docs.deepseek.com/',
        suggestedModels: [
            {id: 'deepseek-chat', name: 'DeepSeek Chat', context: 1000000, output: 384000},
            {id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', context: 1000000, output: 384000},
            {id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', context: 1000000, output: 384000},
        ],
    },
    {
        id: 'cohere',
        label: 'Cohere',
        apiSurface: 'chat-completions',
        modelsDevId: 'cohere',
        baseURL: 'https://api.cohere.ai/compatibility/v1',
        keyRequired: true,
        keysUrl: 'https://dashboard.cohere.com/api-keys',
        docsUrl: 'https://docs.cohere.com/docs/compatibility-api',
        suggestedModels: [
            {id: 'command-a-03-2025', name: 'Command A', context: 256000, output: 8000},
            {id: 'command-a-reasoning-08-2025', name: 'Command A Reasoning', context: 256000, output: 32000},
            {id: 'command-r-plus-08-2024', name: 'Command R+', context: 128000, output: 4000},
        ],
    },
    {
        id: 'vercel',
        label: 'Vercel AI Gateway',
        apiSurface: 'chat-completions',
        modelsDevId: 'vercel',
        baseURL: 'https://ai-gateway.vercel.sh/v1',
        keyRequired: true,
        keysUrl: 'https://vercel.com/docs/ai-gateway',
        docsUrl: 'https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions',
        suggestedModels: [
            {id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', context: 1000000, output: 128000},
            {id: 'zai/glm-5.2', name: 'GLM 5.2', context: 1000000, output: 128000},
            {id: 'moonshotai/kimi-k2.7-code', name: 'Kimi K2.7 Code', context: 256000, output: 32768},
        ],
    },
    {
        id: 'sambanova',
        label: 'SambaNova',
        apiSurface: 'chat-completions',
        modelsDevId: null,
        baseURL: 'https://api.sambanova.ai/v1',
        keyRequired: true,
        keysUrl: 'https://cloud.sambanova.ai/apis',
        docsUrl: 'https://docs.sambanova.ai/docs/en/features/openai-compatibility',
        suggestedModels: [],
    },
    {
        id: 'tokenrouter',
        label: 'TokenRouter',
        apiSurface: 'chat-completions',
        modelsDevId: null,
        baseURL: 'https://api.tokenrouter.com/v1',
        keyRequired: true,
        keysUrl: 'https://tokenrouter.com',
        docsUrl: 'https://www.tokenrouter.com/docs',
        suggestedModels: [],
    },
];
