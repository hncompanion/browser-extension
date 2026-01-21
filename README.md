# Hacker News Companion

AI-powered summaries tuned to HN's threaded discussions + Vim-style keyboard navigation.

[![Demo video](http://img.youtube.com/vi/SJxsczfF9pI/maxresdefault.jpg)](https://youtu.be/SJxsczfF9pI)

**[Chrome Web Store](https://chromewebstore.google.com/detail/hacker-news-companion/khfcainelcaedmmhjicphbkpigklejgf)** • **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/hacker-news-companion/)** • **[Website - hncompanion.com](https://hncompanion.com)** • **[Wiki](https://github.com/hncompanion/browser-extension/wiki)**

## Overview

HN Companion is a browser extension that enhances Hacker News experience with AI summaries that understand HN thread hierarchy and Vim-inspired keyboard navigation.

**Features**: HN-aware summaries • Keyboard navigation • Multiple AI providers • Free cached summaries • Privacy-focused • Open source

👉 **See [hncompanion.com](https://hncompanion.com) for full feature details, demos, and AI setup guides**

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

## Quick Start for Users

1. **Install**: [Chrome](https://chromewebstore.google.com/detail/hacker-news-companion/khfcainelcaedmmhjicphbkpigklejgf) • [Firefox](https://addons.mozilla.org/en-US/firefox/addon/hacker-news-companion/)
2. Visit [news.ycombinator.com](https://news.ycombinator.com)
3. Press `?` to view keyboard shortcuts
4. Click "summarize" on any discussion (uses free cached summaries when available)

**Need AI setup?** See below for provider configuration.
## AI Provider Setup

HN Companion supports multiple AI providers. Choose one and configure it in the extension settings.

### Ollama (Local & Private)
```bash
# 1. Install Ollama from https://ollama.com
# 2. Configure CORS for browser extension access

# macOS/Linux
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"

# Windows
setx OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"

# 3. Restart Ollama
```

### OpenAI
1. Get API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Enter in extension settings

### Anthropic (Recommended)
1. Get API key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Enter in extension settings

### Google AI
1. Get API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Enter in extension settings

### OpenRouter (Multi-Model Gateway)
1. Get API key from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Enter API key and model name in extension settings
3. Recommended model: `anthropic/claude-3.5-sonnet`
4. See all models at [openrouter.ai/models](https://openrouter.ai/models)

## Development

### Setup

```bash
git clone https://github.com/hncompanion/browser-extension.git
cd browser-extension

# Install dependencies
pnpm install

# Start development server
pnpm run dev              # Chrome
pnpm run dev:firefox      # Firefox
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Chrome development with hot reload |
| `pnpm run dev:firefox` | Firefox development with hot reload |
| `pnpm run build` | Production build for Chrome |
| `pnpm run build:firefox` | Production build for Firefox |
| `pnpm test` | Run test suite |

### Project Structure

```
src/
├── entrypoints/
│   ├── background/         # Background service worker
│   ├── content/            # Content scripts (HN page enhancements)
│   └── options/            # Extension settings page
├── lib/
│   ├── llm-summarizer.js   # AI provider integrations
│   ├── messaging.js        # Extension messaging
│   └── utils.js            # Shared utilities
└── tests/                  # Test files
```

See the [Wiki](https://github.com/hncompanion/browser-extension/wiki) for architecture details, HN page structure documentation, and implementation notes

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

## Supported Browsers

Officially supported: **Chrome**, **Firefox**, and **Edge**. Also works on Chromium-based browsers like Brave, Arc, and Vivaldi.

## Contributing

Contributions are welcome! Please:
1. Check [existing issues](https://github.com/hncompanion/browser-extension/issues) or open a new one
2. Fork the repository and create a feature branch
3. Submit a pull request with clear description of changes

For questions, use [GitHub Discussions](https://github.com/hncompanion/browser-extension/discussions).

## Resources

- **Website**: [hncompanion.com](https://hncompanion.com) - Features, demos, setup guides, and FAQ
- **Wiki**: [Technical documentation](https://github.com/hncompanion/browser-extension/wiki) - Architecture, implementation details, and developer notes
- **Issues**: [Report bugs](https://github.com/hncompanion/browser-extension/issues)
- **Discussions**: [Ask questions](https://github.com/hncompanion/browser-extension/discussions)

## License

MIT Licensed - free to use, modify, and distribute.

---

> **Note**: This extension is not endorsed by, affiliated with, or sponsored by Y Combinator or Hacker News.
