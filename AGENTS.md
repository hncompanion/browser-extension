# Repository Guidelines

## Project Overview
Hacker News Companion is a cross-browser (Chrome + Firefox) Manifest V3 extension built with WXT that enhances `news.ycombinator.com`.
- Core features: Vim-style keyboard navigation, hover user previews (via `hn.algolia.com`), and an injected resizable summary panel.
- Summaries: Load cached summaries from `app.hncompanion.com` or generate fresh AI summaries using local Ollama or cloud LLM providers (OpenAI, Anthropic, Google, OpenRouter).
- Key codepaths: `src/entrypoints/content/hnenhancer.js` (page enhancer + UI), `src/entrypoints/background/index.js` (MV3 service worker: fetch + LLM calls), `src/entrypoints/options/` (settings UI), `src/lib/` (shared summarizer + utilities).

## Project Structure
- `src/entrypoints/`: Extension entrypoints (WXT).
  - `background/`: MV3 service worker logic.
  - `content/`: HN page enhancer + injected UI (`hnenhancer.js`, `summary-panel.js`).
  - `options/`: Options page (`index.html`, `options.js`, `options.css`).
- `src/lib/`: Shared modules (AI summarization, utilities/logging).
- `public/`: Static assets (icons in `public/icon/`).
- Generated (do not edit/commit): `.wxt/`, `.output/` (both ignored by `.gitignore`).

## Build, Test, and Development Commands
Use `pnpm` (see `packageManager` in `package.json`).
- `pnpm i`: Install dependencies.
- `pnpm run dev`: Chrome dev build/watch via WXT.
- `pnpm run dev:firefox`: Firefox dev build/watch.
- `pnpm run build`: Production build (Chrome).
- `pnpm run build:firefox`: Production build (Firefox MV3).
- `pnpm run zip` / `pnpm run zip:firefox`: Create store-ready bundles.

## Coding Style & Naming
- ES modules (`type: "module"`); prefer `async/await` and explicit error handling.
- Match existing style: 4-space indentation and semicolons are commonly used.
- Naming: `camelCase` for variables/functions, `PascalCase` for classes.
- Prefer WXT abstractions (`wxt/browser`, `#imports` `storage`) over raw `chrome.*` APIs.

## Testing Guidelines
There is no test command wired in `package.json` today. If you add tests, prefer:
- `*.test.js` naming (see `jest.config.js`), colocated near the module under test.
- A small `pnpm` script (e.g. `test`) and pinned devDependencies for the chosen runner.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (examples in history: `feat:`, `fix:`, `refactor:`, `chore:`).
- PRs should include: what/why, any user-facing changes (screenshots for options/UI), and notes on browser verification (Chrome + Firefox when applicable).
- Manifest/permission changes should be made in `wxt.config.ts` (manifest is generated).

## Security & Configuration Tips
- Never commit API keys or secrets; keep provider credentials in extension settings storage.
- When touching network calls/hosts, re-check `host_permissions`/`optional_host_permissions` in `wxt.config.ts` and validate behavior in both browsers.
