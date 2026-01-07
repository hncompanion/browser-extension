### Hacker News Companion - Chrome Extension

[![Basic features video](http://img.youtube.com/vi/SJxsczfF9pI/maxresdefault.jpg)](https://youtu.be/SJxsczfF9pI)

> [!TIP]
> You can also find this extension on the [Chrome Web Store](https://chromewebstore.google.com/detail/hacker-news-companion/khfcainelcaedmmhjicphbkpigklejgf).
> Or on the [Firefox Addon store](https://addons.mozilla.org/en-US/firefox/addon/hacker-news-companion/).

## 🚀 Quick Start Guide
1. Install from [Chrome Web Store](https://chromewebstore.google.com/detail/hacker-news-companion/khfcainelcaedmmhjicphbkpigklejgf) or [Firefox Addon store](https://addons.mozilla.org/en-US/firefox/addon/hacker-news-companion/)
2. Navigate to [Hacker News](https://news.ycombinator.com)
3. Press '?' to view keyboard shortcuts
4. Choose your preferred AI provider in extension settings

### Overview
Transform your Hacker News experience with AI-powered summaries, and keyboard navigation with vim-style shortcuts. 
This extension streamlines how you read and navigate through discussions, making it easier than ever to engage with rich conversations.

### 🌟 Key Features
* **AI-Powered Summarization**
   * Multiple AI provider options
   * Connect to cloud-hosted models - Google AI, Anthropic, OpenAI, OpenRouter for advanced summaries
   * Use local models hosted on Ollama
   
* **Smart Keyboard Navigation**
  * Vim-inspired shortcuts (`h`, `j`, `k`, `l`) for intuitive movement
  * Quick-jump between comments by the same author (`[` and `]`)
  * Collapsible comment threads (`c` to toggle) or open comments in the home page
  * Press '?' to view all shortcuts

* **Enhanced Comment Navigation**
    * Quick-jump between comments by the same author
    * Visual indicators for post authors and comment counts
    * Comment count display

* **Rich User Interactions**
    * User profile previews on hover
    * Resizable summary panel

## 🤖 AI Provider Setup Guide

### Ollama 
1. Requirements:
    * [Ollama](https://ollama.com/) installed on your system
    * CORS configuration for the extension

2. Setup Steps (to configure CORS):
   ```bash
   # Mac OS
   launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"
   
   # Windows
   setx OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"
   
   # Make sure to restart Ollama after setting the environment variable.
   ```
3. Best Practices:
    * Restart Ollama after CORS configuration
    * Set CORS environment variable to persist across restarts

### Google AI
1. Requirements:
   * Google AI [API key](https://aistudio.google.com/apikey)
   * Active Google Cloud account

### Anthropic (Recommended for Best Performance)
1. Requirements:
   * Anthropic API key
   * Active Anthropic account

2. Setup Steps:
   * Generate API key at [Anthropic Console](https://console.anthropic.com)
   * Enter API key in extension settings

### OpenAI
1. Requirements:
    * OpenAI API key
    * Active OpenAI account

2. Setup Steps:
    * Generate API key at [OpenAI Platform](https://platform.openai.com)
    * Enter API key in extension settings (click on the extension icon)

### OpenRouter
[OpenRouter](https://openrouter.ai/) is a service that provides unified access to multiple large language models (LLMs) through a single API. This platform simplifies the integration and management of different AI models, such as GPT, Claude, and Grok, allowing developers to switch between them without dealing with separate APIs.

1. Requirements:
    * OpenRouter API key
    * Active OpenRouter account with credits

2. Setup Steps:
    * Generate an API key at [OpenRouter](https://openrouter.ai/settings/keys)
    * Enter API key in extension settings (click on the extension icon)
    * Enter your preferred model
        * A list of available models can be found at [OpenRouter models](https://openrouter.ai/models)
        * `anthropic/claude-3.5-sonnet` is our default and a great model to start with

## ⌨️ Keyboard Shortcuts

### Global
* `?` / `/` - Toggle help panel
* `o` - Open post in new window

### Home Page
* `j` / `k` - Next/previous post
* `c` - Open comments page

### Comments Page
* `j` / `k` - Next/previous comment
* `l` / `h` - Next child/parent comment
* `[` / `]` - Previous/next comment by author
* `s` - Toggle summary panel
* `r` - Go to root comment
* `gg` - First comment
* `z` - Scroll to current
* `c` - Collapse/expand comment
* `u` - Undo last comment navigation


## 🛠️ Development Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/hncompanion/browser-extension.git
   cd browser-extension
   
   # Install dependencies
   pnpm i 
   
   # For chrome development
   pnpm run dev
   
   # For firefox development
   pnpm run dev:firefox
   ```
## 🔧 Troubleshooting

### Common Issues

1. **AI Summarization Not Working**
    * Check API key configuration
    * Ensure selected AI provider is running (for Ollama)

2. **CORS Issues with Ollama**
    * Verify CORS environment variable
    * Restart Ollama after configuration
    * Check Ollama logs for errors

3. **Performance Issues**
    * Try different AI providers
    * Collapse long comment threads
    * Clear browser cache

### Support
* GitHub Issues: [Report bugs](https://github.com/hncompanion/browser-extension/issues)

## 📜 License
MIT Licensed - free to use, modify, and distribute

## 🙏 Acknowledgments
* Hacker News community
* AI provider partners
* Open source contributors
* Valuable feedback from [Liza George](https://www.linkedin.com/in/george-liza/)


> [!NOTE] 
> Note: This extension is not endorsed by, affiliated with, or sponsored by Y Combinator or Hacker News.
