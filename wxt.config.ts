import {defineConfig} from 'wxt';
// @ts-ignore
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
    srcDir: 'src',
    manifest: ({browser}) => {
        let manifest = {
            name: "Hacker News Companion",
            description: "Get the gist of lengthy Hacker News discussions with AI summaries tuned to HN semantics. Navigate seamlessly with Vim keybindings.",
            homepage_url: "https://hncompanion.com",
            version: "2.0.1",
            permissions: ['storage'],
            host_permissions: [
                "https://news.ycombinator.com/*",
                "https://hn.algolia.com/*",
                "https://app.hncompanion.com/*"
            ],
            optional_host_permissions: [
                "https://api.openai.com/*",
                "https://api.anthropic.com/*",
                "https://openrouter.ai/*",
                "https://api.groq.com/*",
                "https://api.together.ai/*",
                "https://api.fireworks.ai/*",
                "https://api.deepinfra.com/*",
                "https://api.mistral.ai/*",
                "https://api.cerebras.ai/*",
                "https://api.perplexity.ai/*",
                "https://api.x.ai/*",
                "https://api.novita.ai/*",
                "https://api.sambanova.ai/*",
                "https://api.z.ai/*",
                "https://api.tokenrouter.com/*",
                "https://api.deepseek.com/*",
                "https://api.cohere.ai/*",
                "https://api.cloudflare.com/*",
                "https://ai-gateway.vercel.sh/*",
                "https://*.oci.oraclecloud.com/*",
                "https://generativelanguage.googleapis.com/*",
                "http://host.docker.internal/*",
                "https://ollama.com/*",
                "http://localhost/*",
                "http://127.0.0.1/*"
            ],
            icons: {
                16: '/icon/icon-16.png',
                32: '/icon/icon-32.png',
                48: '/icon/icon-48.png',
                128: '/icon/icon-128.png',
            },
            action: {},
        };
        if(browser === 'firefox') {
            manifest["browser_specific_settings"] = {
                gecko: {
                    id: "addon@hncompanion.com"
                }
            }
        }
        else if(browser === 'chrome') {
            manifest["key"] = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA33BeK36zhT3F5xqyEVply+YGOOwy8r3nvSmRW59wW3y6qjXFPrUtLMm2SlMt52qRbPOVJQm27KvcE385MJ3xrbgeGNryeAS2QTHDMeMW6hJS/Q3+aOX6SDJcLKC9mghHmho13WyczO9AHo2a1IhpvXVKnrEf9gHXcO7lOXlwPJLVUG8galL4OQyPApKbyR6481TTCj9sDvKS1fgsTNGW/le1zPVMrEa0Fqc5S9vz2zEaPdEW3G6SHHL+mRbKcd3iTA1WzjEIq0NaSvRxay5D3p77F83GpN0qM1nCDy2GNqN+nJDHM9ZSLm1Y7J5gtmDvJ0B4YY/uWXqBu+l0sjHzDwIDAQAB";
        }
        return manifest;
    },
    vite: () => ({
        plugins: [
            tailwindcss(),
        ],
        build: {
            minify: false, // Disable minification
        }
    }),
});
