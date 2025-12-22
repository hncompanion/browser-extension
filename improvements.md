# Improvements Backlog

This is a review-backed list of potential improvements found while scanning the codebase. Each entry is intended to be actionable and independently addressable.

## High Priority

### IMP-001 — Prevent settings reset on extension update [Completed]
- **Problem:** `onInstalled()` always calls `setDefaultSettings()`, which overwrites `sync:settings` and can wipe user API keys/preferences on updates.
- **Where:** `src/entrypoints/background/index.js:45` and `src/entrypoints/background/index.js:48`
- **Suggestion:** Only set defaults on fresh install (`details.reason === 'install'`) and/or merge defaults only when keys are missing.

### IMP-002 — Fix options page “first run” logic (missing `await`) [Completed]
- **Problem:** `hasShownOptionsPage` is a Promise (missing `await`), so the `if (!hasShownOptionsPage)` branch is incorrect.
- **Where:** `src/entrypoints/background/index.js:52`
- **Suggestion:** `const hasShownOptionsPage = await storage.getItem('local:hasShownOptionsPage');`

### IMP-003 — Fix logging gating (sync methods ignore enable flag)  [Completed]
- **Problem:** `Logger.infoSync()` logs regardless of whether logging is enabled (it ignores the resolved boolean); `Logger.debugSync()` uses an in-memory flag that is never set by `enableLoggingSync()`.
- **Where:** `src/lib/utils.js:18` and `src/lib/utils.js:30`
- **Suggestion:** Make sync log methods consistent (either remove them, or store the resolved enabled flag, or expose a single “enabled” gate that both async/sync use).

### IMP-004 — Errors may be silently dropped in production  [Completed]
- **Problem:** `Logger.error()` is gated behind `Logger.isEnabled()`, so failures can be invisible unless logging is enabled.
- **Where:** `src/lib/utils.js:36`
- **Suggestion:** Always log errors (or at least critical errors) even when debug logging is disabled.

### IMP-005 — AI SDK call settings use wrong parameter names (tuning likely ignored)  [Completed]
- **Problem:** `generateText()` is passed snake_case settings (`top_p`, `max_tokens`, `frequency_penalty`, `presence_penalty`), but the AI SDK expects camelCase settings like `topP`, `maxOutputTokens`, `frequencyPenalty`, `presencePenalty`.
- **Where:** `src/lib/llm-summarizer.js:55`
- **Suggestion:** Rename settings to match the AI SDK API and pass `temperature`/`topP` consistently.

### IMP-006 — Optional host permissions are declared but never requested  [Completed]
- **Problem:** `optional_host_permissions` are set, but there is no runtime flow to request them (no `browser.permissions.request` usage), so provider fetch calls may fail without user-granted permission.
- **Where:** `wxt.config.ts:20` and (absence of usage) `src/` (no permission request flow found)
- **Suggestion:** Add a permission-request flow (ideally from options UI) before calling external LLM endpoints.

### IMP-007 — Host permissions are incomplete / patterns look too narrow  [Completed]
- **Problem:** Google LLM host permission is missing; OpenAI/Anthropic patterns appear overly specific (may not match actual request URLs); OpenRouter/others may evolve.
- **Where:** `wxt.config.ts:15`
- **Suggestion:** Add missing provider hosts (e.g., Google) and use durable host patterns (e.g., `https://api.openai.com/*`, `https://api.anthropic.com/*`) as appropriate for your actual request paths.

### IMP-008 — XSS risk: untrusted content inserted via `innerHTML`
- **Problem:** Several places inject untrusted strings using `innerHTML` (LLM output, user "about" field, and other HTML snippets). This risks DOM XSS inside the extension-injected UI.
- **Where:** `src/entrypoints/content/summary-panel.js:59`, `src/entrypoints/content/summary-panel.js:188`, `src/entrypoints/content/hnenhancer.js:1114`, `src/entrypoints/content/hnenhancer.js:765`
- **Suggestion:** Use a proper markdown renderer + sanitizer (e.g., DOMPurify) and prefer `textContent` for plain text. Enforce safe link protocols and add `rel="noopener noreferrer"` for external links.

### IMP-017 — Missing Google AI host permission
- **Problem:** Google AI SDK uses `generativelanguage.googleapis.com` but this host is not included in `optional_host_permissions`. Google AI requests may fail silently without the proper permission.
- **Where:** `wxt.config.ts:20-24`
- **Suggestion:** Add `https://generativelanguage.googleapis.com/*` to `optional_host_permissions`.

### IMP-018 — Duplicate `sendBackgroundMessage` implementation
- **Problem:** The `sendBackgroundMessage` function is implemented twice with nearly identical logic in both the options page and the content script.
- **Where:** `src/entrypoints/options/options.js:59-78` and `src/entrypoints/content/hnenhancer.js:349-385`
- **Suggestion:** Extract to a shared utility module in `src/lib/` and import where needed.

### IMP-019 — No timeout on user info fetch
- **Problem:** `fetchUserInfo()` makes an API call to `hn.algolia.com` without a timeout. If the API is slow or unresponsive, the request could hang indefinitely.
- **Where:** `src/entrypoints/content/hnenhancer.js:387-427`
- **Suggestion:** Add a reasonable timeout (e.g., 5-10 seconds) to the user info fetch request.

### IMP-020 — Memory leak potential in event listeners
- **Problem:** Event listeners added in `setupUserHover()` are never cleaned up. Document-level click and keydown listeners persist for the lifetime of the page. On SPAs or long-lived pages, this could accumulate.
- **Where:** `src/entrypoints/content/hnenhancer.js:1107-1165`
- **Suggestion:** Store listener references and provide a cleanup method, or use `AbortController` for event listener management.

## Medium Priority

### IMP-009 — Brittle prompt template extraction via `Function.toString()`
- **Problem:** The options UI derives the default user prompt by parsing `AI_USER_PROMPT_TEMPLATE.toString()`, which is fragile and likely to break when minified/bundled.
- **Where:** `src/entrypoints/options/options.js:174` and `src/entrypoints/options/options.js:181`
- **Suggestion:** Export a real string constant for the default template and interpolate `${title}` / `${text}` yourself.

### IMP-010 — Model configuration is out of sync with options defaults
- **Problem:** Options defaults include newer model IDs (e.g., OpenAI `gpt-5`, Google `gemini-2.5-pro`, Anthropic `claude-opus-4-1`), but `getModelConfiguration()` only lists older IDs and placeholders, so settings fall back to generic defaults.
- **Where:** `src/entrypoints/content/hnenhancer.js:1778`
- **Suggestion:** Align model IDs across `options/index.html`, `options.js`, and `getModelConfiguration()` (or remove the per-model table and use provider defaults + user overrides).

### IMP-011 — Event handling may be heavy on large threads (no delegation/caching)
- **Problem:** The content script attaches many per-element listeners (e.g., `.hnuser` hover, comment click), and user hover triggers network calls repeatedly without caching.
- **Where:** `src/entrypoints/content/hnenhancer.js:1107` and `src/entrypoints/content/hnenhancer.js:2066`
- **Suggestion:** Use event delegation, cache user info responses, and throttle/debounce hover fetches.

### IMP-012 — `SummaryPanel` lacks null guards for unexpected DOM shapes
- **Problem:** If the expected HN table isn’t found, `createPanel()` can return `null`, but the constructor still uses `this.mainWrapper.appendChild(...)`.
- **Where:** `src/entrypoints/content/summary-panel.js:2`
- **Suggestion:** Add defensive checks and fail gracefully (no panel) if the DOM structure changes.

### IMP-013 — Manifest includes MV2-era `page_action`
- **Problem:** `page_action` is included in the generated manifest; MV3 uses `action`. Keeping both can be confusing and may be ignored.
- **Where:** `wxt.config.ts:33`
- **Suggestion:** Remove `page_action` unless there is a specific cross-browser requirement.

### IMP-021 — No error boundary in content script initialization
- **Problem:** If the `HNEnhancer` constructor throws an exception, the entire content script fails with no graceful degradation. Users see a broken page with no feedback.
- **Where:** `src/entrypoints/content/index.js`
- **Suggestion:** Wrap `HNEnhancer` instantiation in a try-catch block and log errors. Consider showing a minimal error indicator to users.

### IMP-022 — Inconsistent error logging patterns
- **Problem:** Error handling uses a mix of `await Logger.error()`, `Logger.infoSync()`, and direct `console.error()` calls. This makes debugging difficult and error tracking inconsistent.
- **Where:** Throughout codebase (e.g., `hnenhancer.js`, `options.js`, `llm-summarizer.js`)
- **Suggestion:** Standardize on a single error logging approach. Consider always using `Logger.error()` for errors and ensuring it logs regardless of debug flag (see IMP-004).

### IMP-023 — No debounce on user hover fetch
- **Problem:** Rapid mouse movements over user elements trigger multiple API calls in quick succession. Each hover immediately fires a fetch request.
- **Where:** `src/entrypoints/content/hnenhancer.js:1109`
- **Suggestion:** Add a debounce (e.g., 200-300ms delay) before fetching user info to avoid unnecessary API calls during quick mouse movements.

### IMP-024 — Markdown converter uses fragile regex parsing
- **Problem:** `convertMarkdownToHTML()` uses regex-based parsing that may break on edge cases like nested markdown, escaped characters, or malformed input. Could also contribute to XSS if not careful.
- **Where:** `src/entrypoints/content/hnenhancer.js:765-825`
- **Suggestion:** Consider using a lightweight markdown library (e.g., marked, markdown-it) combined with DOMPurify for sanitization. This would be more robust and address part of IMP-008.

## Low Priority / Hygiene

### IMP-014 — Production builds are configured without minification
- **Problem:** Vite `minify: false` is hard-coded, which increases bundle size and may slow load.
- **Where:** `wxt.config.ts:51`
- **Suggestion:** Enable minification for production builds (keep readable output only for dev if needed).

### IMP-015 — IDE config is tracked in git (`.idea/`)
- **Problem:** `.idea/` files are committed; these are usually developer-specific.
- **Where:** `.idea/*` (tracked)
- **Suggestion:** Remove from git and add to `.gitignore` (unless your team standardizes on committing these).

### IMP-016 — Privacy policy wording is likely inaccurate given data flows
- **Problem:** `PRIVACY.md` says the extension does not transmit any user data, but summaries send thread text to third-party LLMs and API keys are stored (and potentially synced).
- **Where:** `PRIVACY.md:4`
- **Suggestion:** Update wording to clearly describe what is sent to LLM providers, what is stored locally/synced, and when the cache server is used.

