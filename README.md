### Hacker News Companion - Browser Extension

[![Demo video](http://img.youtube.com/vi/SJxsczfF9pI/maxresdefault.jpg)](https://youtu.be/SJxsczfF9pI)

> [!TIP]
> Install on the [Chrome Web Store](https://chromewebstore.google.com/detail/hacker-news-companion/khfcainelcaedmmhjicphbkpigklejgf) or the [Firefox Addon store](https://addons.mozilla.org/en-US/firefox/addon/hacker-news-companion/).
> You can also see the latest product overview at [hncompanion.com](https://hncompanion.com).

## 🚀 Quick Start Guide
1. Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/hacker-news-companion/khfcainelcaedmmhjicphbkpigklejgf) or [Firefox Addon store](https://addons.mozilla.org/en-US/firefox/addon/hacker-news-companion/).
2. Navigate to [Hacker News](https://news.ycombinator.com).
3. Press '?' to view keyboard shortcuts.
4. Choose your preferred AI provider in extension settings, or use cached summaries when available.

### Overview
Get the gist of long HN discussions with summaries tuned to the HN semantics of threads, rankings and hierarchy of conversations. Move through the comments fast with Vim-style navigation. This README aligns with the product overview at [hncompanion.com](https://hncompanion.com) and the store listing language used for the extension.

### 🌟 Key Features
* **Summaries Built for HN**
    * Understands thread hierarchy, conversation flow, and rankings
    * Highlights key debates, contrasting viewpoints, and side discussions
    * Cached summaries available for popular stories

* **Follow the Conversation**
    * Jump to specific comments from the summary
    * Navigate to other comments by the same author (`[` and `]`)
    * User profile previews on hover (karma, account age)

* **Fully Customizable**
    * Bring your own API key (OpenAI, Anthropic, Google, OpenRouter)
    * Or run locally with Ollama for complete privacy
    * Customize system and user prompts in settings

* **Keyboard-First Navigation**
    * Vim-inspired shortcuts (`h`, `j`, `k`, `l`) for intuitive movement
    * Collapse/expand threads (`c`) and jump to first comment (`gg`)
    * Press '?' anytime to view all shortcuts

* **Privacy-Focused & Open Source**
    * No tracking or analytics
    * Runs only on Hacker News pages
    * Open source on [GitHub](https://github.com/hncompanion/browser-extension)

## 🤖 AI Provider Setup Guide
You can use free cached summaries when available, or connect your own provider for fresh summaries and model choice.

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

## ✅ Supported Browsers
Officially supported: Chrome, Firefox, and Edge. Also works on Chromium browsers like Brave, Arc, and Vivaldi.

## 🔒 Privacy
HN Companion runs only on Hacker News pages and stores your settings locally. It has zero analytics or tracking and never sends your API keys to any server. You can also use local-only summaries with [Ollama](https://ollama.com/).

## 📚 Documentation
* [Wiki home](https://github.com/hncompanion/browser-extension/wiki) for high-level project docs
* [Summarizing threaded discussions with LLMs](https://github.com/hncompanion/browser-extension/wiki/HN-Companion-Wiki-Home) for the summary approach
* [HN Page Structure](https://github.com/hncompanion/browser-extension/wiki/HN-Page-Structure) for DOM and parsing details
* [Developer Notes](https://github.com/hncompanion/browser-extension/wiki/Developer-Notes) for implementation notes


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
* Report bugs on [GitHub Issues](https://github.com/hncompanion/browser-extension/issues)
* Ask questions in [GitHub Discussions](https://github.com/hncompanion/browser-extension/discussions)

## 📜 License
MIT Licensed - free to use, modify, and distribute

## 🙏 Acknowledgments
* Hacker News community
* AI provider partners
* Open source contributors
* Valuable feedback from [Liza George](https://www.linkedin.com/in/george-liza/)


> [!NOTE] 
> Note: This extension is not endorsed by, affiliated with, or sponsored by Y Combinator or Hacker News.
