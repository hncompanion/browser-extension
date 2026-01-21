# Project Structure

- `src/entrypoints/`: Extension entrypoints (WXT).
  - `background/`: MV3 service worker logic.
  - `content/`: HN page enhancer + injected UI (`hnenhancer.js`, `summary-panel.js`).
  - `options/`: Options page (`index.html`, `options.js`, `options.css`).
- `src/lib/`: Shared modules (AI summarization, utilities/logging).
- `public/`: Static assets (icons in `public/icon/`).
- Generated (do not edit/commit): `.wxt/`, `.output/` (both ignored by `.gitignore`).

## Content Script Module Map

`src/entrypoints/content/`
- `hnenhancer.js`: Main orchestrator for page detection and module wiring.
- `ai-summarizer.js`: AI provider config, request handling, and cache integration.
- `comment-navigator.js`: Comment focus, traversal, and undo history.
- `comment-processor.js`: Fetches Algolia data, merges DOM metadata, and builds interactive comment DOM.
- `keyboard-shortcuts.js`: Page-specific and global shortcut handling.
- `help-modal.js`: Shortcut help UI.
- `user-popup.js`: Hover user info lookup and display.
- `summary-panel.js`: Summary panel UI component.
- `hnstate.js`: Persistent state management.
- `constants.js`: AI prompts and configuration.

`src/lib/`
- `dom-utils.js`: Generic DOM helpers.
- `text-utils.js`: Text processing and truncation utilities.
- `utils.js`: Logger and general utilities.
- `messaging.js`: Background script communication.
- `sanitize.js`: HTML sanitization.

## More details
- `docs/ARCHITECTURE.md`: Architecture reference.