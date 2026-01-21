# Hacker News Companion

AI-powered summaries tuned to HN's threaded discussions + Vim-style keyboard navigation.

[![Demo video](http://img.youtube.com/vi/SJxsczfF9pI/maxresdefault.jpg)](https://youtu.be/SJxsczfF9pI)

**[Chrome Web Store](https://chromewebstore.google.com/detail/hacker-news-companion/khfcainelcaedmmhjicphbkpigklejgf)** • **[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/hacker-news-companion/)** • **[Website](https://hncompanion.com)** • **[Wiki](https://github.com/hncompanion/browser-extension/wiki)**

## Overview

HN Companion enhances Hacker News with AI summaries that understand thread hierarchy and Vim-inspired keyboard navigation.

**Features**: HN-aware summaries • Keyboard navigation • Multiple AI providers • Free cached summaries • Privacy-focused • Open source

👉 **See [hncompanion.com](https://hncompanion.com) for full feature details, demos, and AI setup guides**

## Quick Start for Users

1. **Install**: [Chrome](https://chromewebstore.google.com/detail/hacker-news-companion/khfcainelcaedmmhjicphbkpigklejgf) • [Firefox](https://addons.mozilla.org/en-US/firefox/addon/hacker-news-companion/)
2. Visit [news.ycombinator.com](https://news.ycombinator.com)
3. Press `?` to view keyboard shortcuts
4. Click "summarize" on any discussion (uses free cached summaries when available)

**Need AI setup?** See the [setup guide](https://hncompanion.com/#faq) for configuring OpenAI, Anthropic, Google, OpenRouter, or local Ollama.

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
