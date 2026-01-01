# Privacy Policy for Hacker News Companion

## Data Collection
This extension does not collect or store any personal user data on remote servers controlled by the extension developers.

## Data Transmission
When you use the AI summarization feature, the extension sends Hacker News thread content (post titles and comments) to your configured LLM provider (e.g., OpenAI, Anthropic, Google, OpenRouter, or local Ollama) to generate summaries. This data transmission only occurs when you explicitly request a summary.

## Data Storage
- **Local Storage**: Extension settings and preferences are stored locally in your browser.
- **Browser Sync**: If enabled by your browser, settings (including API keys for LLM providers) may be synced across your devices using your browser's built-in sync functionality. This sync is handled entirely by your browser, not by the extension developers.
- **No Remote Storage**: The extension developers do not store any of your data on remote servers.

## Third-Party Services
The extension makes API calls to:
- `news.ycombinator.com` — to enhance comment navigation on Hacker News
- `hn.algolia.com` — to fetch public user profile information for hover previews
- `app.hncompanion.com` — to fetch cached AI summaries (no personal data is sent; only public HN post IDs)
- LLM providers (when configured) — to generate AI summaries of thread content you request:
  - `api.openai.com` (OpenAI)
  - `api.anthropic.com` (Anthropic)
  - `generativelanguage.googleapis.com` (Google)
  - `openrouter.ai` (OpenRouter)
  - `localhost:11434` (local Ollama instance)

Each LLM provider has its own privacy policy governing how they handle data sent to their APIs.

## Updates
This privacy policy may be updated as the extension evolves. Please review the GitHub repository for any changes.

## Open Source
This extension is open source. You can review the complete source code at: https://github.com/hncompanion/browser-extension

## Contact
For questions about this privacy policy or the extension's privacy practices, please file an [issue](https://github.com/hncompanion/browser-extension/issues) on our GitHub repository.

Last Updated: January 1, 2026