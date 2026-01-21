# Project Overview

Hacker News Companion is a cross-browser (Chrome + Firefox) Manifest V3 extension built with WXT that enhances `news.ycombinator.com`.

- Core features: Vim-style keyboard navigation, hover user previews (via `hn.algolia.com`), and an injected resizable summary panel.
- Summaries: Load cached summaries from `app.hncompanion.com` or generate fresh AI summaries using local Ollama or cloud LLM providers (OpenAI, Anthropic, Google, OpenRouter).
- Key code-paths: `src/entrypoints/content/hnenhancer.js` (page enhancer + UI), `src/entrypoints/background/index.js` (MV3 service worker: fetch + LLM calls), `src/entrypoints/options/` (settings UI), `src/lib/` (shared summarizer + utilities).

# Repository Guidelines

## Essentials
- Package manager: pnpm (see packageManager in package.json).
- Dev build: ask the user to run `pnpm run dev`; do not run it automatically.

## More details
- [Project structure](docs/agents/project-structure.md)
- [State management](docs/agents/state-management.md)
- [Coding style & naming](docs/agents/coding-style.md)

