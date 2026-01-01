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

### IMP-008 — XSS risk: untrusted content inserted via `innerHTML` [Completed]
- **Problem:** Several places inject untrusted strings using `innerHTML` (LLM output, user "about" field, and other HTML snippets). This risks DOM XSS inside the extension-injected UI.
- **Where:** `src/entrypoints/content/summary-panel.js`, `src/entrypoints/content/hnenhancer.js`
- **Solution implemented:**
  1) **Added centralized sanitizer helper** (`src/lib/sanitize.js`): DOMPurify wrapper with `sanitizeHtml()`, `sanitizeHtmlToFragment()`, and `enforceSafeLinks()`. Uses strict allowlist for tags (`p`, `br`, `strong`, `em`, `a`, `code`, `pre`, `ul`, `ol`, `li`, `h1`-`h5`, `blockquote`, `hr`, `img`) and attributes (`href`, `src`, `alt`, `title`, `target`, `rel`, `data-comment-*`).
  2) **Replaced regex markdown parsing**: removed `convertMarkdownToHTML()` and now use `marked` library + `sanitizeHtmlToFragment()` in `createSummaryFragment()`.
  3) **Eliminated all `innerHTML` usage**: `summary-panel.js` now uses `createElement`, `appendChild`, `textContent`, and `replaceChildren()`. Added `setElementContent()` helper that accepts strings or DOM nodes.
  4) **Safer link handling**: `enforceSafeLinks()` validates protocols (only `http:`, `https:`, `mailto:` allowed), removes unsafe hrefs, and enforces `rel="noopener noreferrer"` for `target="_blank"` links.
  5) **DOM-based comment backlink replacement**: `replaceCommentBacklinks()` uses TreeWalker to find text nodes with `[1.1]` patterns and HN URLs, replacing them with safe `<a>` elements built via `createCommentLink()`.
  6) **Error strings use textContent**: `handleSummaryError()` and other error paths pass plain strings to `summaryPanel.updateContent()`, which uses `textContent` for non-Node content.
  7) **Added dependencies**: `dompurify@^3.3.1` and `marked@^17.0.1` to `package.json`.

### IMP-017 — Missing Google AI host permission  [Completed]
- **Problem:** Google AI SDK uses `generativelanguage.googleapis.com` but this host is not included in `optional_host_permissions`. Google AI requests may fail silently without the proper permission.
- **Where:** `wxt.config.ts:20-24`
- **Suggestion:** Add `https://generativelanguage.googleapis.com/*` to `optional_host_permissions`.

### IMP-018 — Duplicate `sendBackgroundMessage` implementation [Completed]
- **Problem:** The `sendBackgroundMessage` function is implemented twice with nearly identical logic in both the options page and the content script.
- **Where:** `src/entrypoints/options/options.js:59-78` and `src/entrypoints/content/hnenhancer.js:349-385`
- **Suggestion:** Extract to a shared utility module in `src/lib/` and import where needed.

### IMP-019 — No timeout on user info fetch [Completed]
- **Problem:** `fetchUserInfo()` makes an API call to `hn.algolia.com` without a timeout. If the API is slow or unresponsive, the request could hang indefinitely.
- **Where:** `src/entrypoints/content/hnenhancer.js:387-427`
- **Suggestion:** Add a reasonable timeout (e.g., 5-10 seconds) to the user info fetch request.

### IMP-020 — Memory leak potential in event listeners [Ignored]
- **Problem:** Event listeners added in `setupUserHover()` are never cleaned up. Document-level click and keydown listeners persist for the lifetime of the page. On SPAs or long-lived pages, this could accumulate.
- **Where:** `src/entrypoints/content/hnenhancer.js:1107-1165`
- **Suggestion:** Store listener references and provide a cleanup method, or use `AbortController` for event listener management.

## Medium Priority

### IMP-009 — Brittle prompt template extraction via `Function.toString()` [Completed]
- **Problem:** The options UI derives the default user prompt by parsing `AI_USER_PROMPT_TEMPLATE.toString()`, which is fragile and likely to break when minified/bundled.
- **Where:** `src/entrypoints/options/options.js:174` and `src/entrypoints/options/options.js:181`
- **Suggestion:** Export a real string constant for the default template and interpolate `${title}` / `${text}` yourself.

### IMP-010 — Model configuration is out of sync with options defaults [Completed]
- **Problem:** Options defaults include newer model IDs (e.g., OpenAI `gpt-5`, Google `gemini-2.5-pro`, Anthropic `claude-opus-4-1`), but `getModelConfiguration()` only lists older IDs and placeholders, so settings fall back to generic defaults.
- **Where:** `src/entrypoints/content/hnenhancer.js:1778`
- **Suggestion:** Align model IDs across `options/index.html`, `options.js`, and `getModelConfiguration()` (or remove the per-model table and use provider defaults + user overrides).

### IMP-011 — Event handling may be heavy on large threads (no delegation/caching) [Completed]
- **Problem:** The content script attaches many per-element listeners (e.g., `.hnuser` hover, comment click), and user hover triggers network calls repeatedly without caching.
- **Where:** `src/entrypoints/content/hnenhancer.js:1107` and `src/entrypoints/content/hnenhancer.js:2066`
- **Suggestion:** Use event delegation, cache user info responses, and throttle/debounce hover fetches.

### IMP-012 — `SummaryPanel` lacks null guards for unexpected DOM shapes [Completed]
- **Problem:** If the expected HN table isn’t found, `createPanel()` can return `null`, but the constructor still uses `this.mainWrapper.appendChild(...)`.
- **Where:** `src/entrypoints/content/summary-panel.js:2`
- **Suggestion:** Add defensive checks and fail gracefully (no panel) if the DOM structure changes.

### IMP-013 — Manifest includes MV2-era `page_action` [Completed] 
- **Problem:** `page_action` is included in the generated manifest; MV3 uses `action`. Keeping both can be confusing and may be ignored.
- **Where:** `wxt.config.ts:33`
- **Suggestion:** Remove `page_action` unless there is a specific cross-browser requirement.

### IMP-021 — No error boundary in content script initialization [Completed]
- **Problem:** If the `HNEnhancer` constructor throws an exception, the entire content script fails with no graceful degradation. Users see a broken page with no feedback.
- **Where:** `src/entrypoints/content/index.js`
- **Suggestion:** Wrap `HNEnhancer` instantiation in a try-catch block and log errors. Consider showing a minimal error indicator to users.

### IMP-022 — Inconsistent error logging patterns [Completed]
- **Problem:** Error handling uses a mix of `await Logger.error()`, `Logger.infoSync()`, and direct `console.error()` calls. This makes debugging difficult and error tracking inconsistent.
- **Where:** Throughout codebase (e.g., `hnenhancer.js`, `options.js`, `llm-summarizer.js`)
- **Suggestion:** Standardize on a single error logging approach. Consider always using `Logger.error()` for errors and ensuring it logs regardless of debug flag (see IMP-004).

### IMP-023 — No debounce on user hover fetch [Completed]
- **Problem:** Rapid mouse movements over user elements trigger multiple API calls in quick succession. Each hover immediately fires a fetch request.
- **Where:** `src/entrypoints/content/hnenhancer.js:1109`
- **Suggestion:** Add a debounce (e.g., 200-300ms delay) before fetching user info to avoid unnecessary API calls during quick mouse movements.

### IMP-024 — Markdown converter uses fragile regex parsing [Completed]
- **Problem:** `convertMarkdownToHTML()` uses regex-based parsing that may break on edge cases like nested markdown, escaped characters, or malformed input. Could also contribute to XSS if not careful.
- **Where:** `src/entrypoints/content/hnenhancer.js:765-825`
- **Suggestion:** Consider using a lightweight markdown library (e.g., marked, markdown-it) combined with DOMPurify for sanitization. This would be more robust and address part of IMP-008.

## Low Priority / Hygiene

### IMP-014 — Production builds are configured without minification [Ignored]
- **Problem:** Vite `minify: false` is hard-coded, which increases bundle size and may slow load.
- **Where:** `wxt.config.ts:51`
- **Suggestion:** Enable minification for production builds (keep readable output only for dev if needed).

### IMP-015 — IDE config is tracked in git (`.idea/`) [Ignored]
- **Problem:** `.idea/` files are committed; these are usually developer-specific.
- **Where:** `.idea/*` (tracked)
- **Suggestion:** Remove from git and add to `.gitignore` (unless your team standardizes on committing these).

### IMP-016 — Privacy policy wording is likely inaccurate given data flows [Completed]
- **Problem:** `PRIVACY.md` says the extension does not transmit any user data, but summaries send thread text to third-party LLMs and API keys are stored (and potentially synced).
- **Where:** `PRIVACY.md:4`
- **Suggestion:** Update wording to clearly describe what is sent to LLM providers, what is stored locally/synced, and when the cache server is used.

### IMP-017 — Implement test harness for the HTML sanitization functions [Completed]
- **Problem:** The new sanitization functions are critical for security but lack automated tests to verify
- **Where:** `src/entrypoints/content/summary-panel.js`, `src/entrypoints/content/hnenhancer.js`
- **Suggestion:** Create unit tests using a framework like Jest to cover various input cases, ensuring that malicious content is properly sanitized and safe HTML is preserved.

### IMP-025 — `adjustMainContentWidth` lacks null guard for `#hnmain` [Completed]
- **Problem:** `adjustMainContentWidth()` in `SummaryPanel` calls `document.querySelector('#hnmain')` without checking if the element exists, which could throw if the DOM structure changes.
- **Where:** `src/entrypoints/content/summary-panel.js:169`
- **Suggestion:** Add a null check before accessing `hnTable.style`.

### IMP-026 — `fetchOllamaModels` error logged at info level [Completed]
- **Problem:** When fetching Ollama models fails, the error is logged with `Logger.info()` instead of `Logger.error()`, inconsistent with IMP-022 standardization.
- **Where:** `src/entrypoints/options/options.js:246`
- **Suggestion:** Change `Logger.info()` to `Logger.error()` for error conditions.
- **Solution:** Changed to `Logger.debug()` since Ollama not running is expected, not an error. Also added `isErrorExpected` flag to suppress error logs in background script and messaging module.

### IMP-027 — No validation of user-provided prompts before sending to LLM [Ignored]
- **Problem:** Custom system/user prompts from settings are sent directly to LLM APIs without validation. Extremely long or malformed prompts could cause API errors or unexpected behavior.
- **Where:** `src/entrypoints/content/hnenhancer.js:2000-2012`
- **Suggestion:** Add basic validation (e.g., max length, non-empty) for custom prompts before sending to LLM.

### IMP-028 — `decodeHtmlEntities` uses incomplete entity map [Completed]
- **Problem:** `decodeHtmlEntities()` only handles a small set of common HTML entities. Other valid entities (e.g., `&nbsp;`, `&mdash;`, numeric entities like `&#8212;`) will pass through unprocessed.
- **Where:** `src/entrypoints/content/hnenhancer.js:880-896`
- **Suggestion:** Use a more complete solution like creating a temporary textarea element to decode entities, or expand the entity map.

### IMP-029 — Keyboard shortcut handler doesn't clear stale key combination state [Ignored]
- **Problem:** The `lastKey` and `lastKeyPressTime` variables are only cleared on successful combination. If a user starts a combination but doesn't complete it within timeout, the stale state persists until another key is pressed.
- **Where:** `src/entrypoints/content/hnenhancer.js:528-586`
- **Suggestion:** Add a timeout to automatically clear stale key combination state after `KEY_COMBO_TIMEOUT`.
- **Reason ignored:** The existing code already checks `(currentTime - lastKeyPressTime) < KEY_COMBO_TIMEOUT` before using `lastKey`, so stale state is effectively ignored. No functional issue exists.

### IMP-030 — Background script `summarizeText` return value missing duration [Ignored]
- **Problem:** The `HN_SUMMARIZE` handler in background script returns `{ summary }` but doesn't include the duration like `FETCH_API_REQUEST` does. The content script expects `data.duration` which will be undefined.
- **Where:** `src/entrypoints/background/index.js:90-91`
- **Suggestion:** Track and return duration from the `summarizeText` call, or handle missing duration gracefully in the content script.
- **Reason ignored:** The `sendBackgroundMessage` function in messaging.js already tracks round-trip duration and adds it to the response data (line 41). No change needed.

### IMP-031 — `HNState.getLastSeenPostId()` throws on null storage data [Completed]
- **Problem:** `getLastSeenPostId()` accesses `data.lastSeenPost` without first checking if `data` is truthy. If storage returns `null` or `undefined`, this causes a TypeError.
- **Where:** `src/entrypoints/content/hnstate.js:21`
- **Solution:** Added null check: `if (!data || !data.lastSeenPost || ...)`.

### IMP-032 — Ollama URL is hardcoded in multiple places
- **Problem:** The Ollama API endpoint (`http://localhost:11434`) is hardcoded in both `hnenhancer.js` and `options.js`. Users running Ollama on a different host or port cannot use the extension.
- **Where:** `src/entrypoints/content/hnenhancer.js:2119`, `src/entrypoints/options/options.js:221`
- **Suggestion:** Add an Ollama URL configuration field to the options page and store it in settings. Use this configured URL instead of the hardcoded value.

### IMP-033 — Missing error handling for `marked.parse()` in `createSummaryFragment()`
- **Problem:** `marked.parse()` can throw an error for malformed markdown input, but the call is not wrapped in a try-catch block. A malformed LLM response could crash the summary display.
- **Where:** `src/entrypoints/content/hnenhancer.js:821`
- **Suggestion:** Wrap `marked.parse()` in a try-catch and fall back to displaying the raw text if parsing fails.

### IMP-034 — `userInfoCache` Map has no size limit
- **Problem:** The `userInfoCache` Map in HNEnhancer stores user info indefinitely and can grow unbounded. On pages with many unique users (e.g., large discussions), this could lead to excessive memory usage.
- **Where:** `src/entrypoints/content/hnenhancer.js:36`
- **Suggestion:** Implement a maximum cache size (e.g., LRU cache with 100-200 entries) or add a TTL-based expiration for cached entries.

### IMP-035 — Unused `browser` import in `hnstate.js`
- **Problem:** The `browser` import from `wxt/browser` is declared but never used in the file. All storage operations use the `storage` import from `#imports`.
- **Where:** `src/entrypoints/content/hnstate.js:1`
- **Suggestion:** Remove the unused `import {browser} from "wxt/browser";` line.

### IMP-036 — `getHNThread()` returns `undefined` on error [Completed]
- **Problem:** When `getHNThread()` catches an error, it logs but doesn't return a value. The calling code (`summarizeThread`, `summarizeAllComments`) expects an object with `formattedComment` and `commentPathToIdMap`. The undefined return causes downstream errors.
- **Where:** `src/entrypoints/content/hnenhancer.js:1526-1528`
- **Solution:**
  1. `getHNThread()` now returns `null` on error.
  2. Updated `summarizeThread()` to check for null before destructuring.
  3. Updated `summarizeAllComments()` to check for null and display user-friendly error message.

### IMP-037 — SummaryPanel document-level event listeners are never removed
- **Problem:** `setupResizeHandlers()` attaches `mousemove` and `mouseup` listeners to `document` that are never cleaned up. While the panel persists for the page lifetime, this pattern could cause issues if the panel is ever re-instantiated.
- **Where:** `src/entrypoints/content/summary-panel.js:108-126`
- **Suggestion:** Store listener references and provide a `destroy()` method that removes them, or use `AbortController` for event listener management.

### IMP-038 — `enrichPostComments()` silently swallows missing parent comments
- **Problem:** When calculating paths in `enrichPostComments()`, if a parent comment was skipped (flagged/collapsed), `enrichedComments.get(comment.parentId)` returns undefined, and accessing `.path` on it throws an error.
- **Where:** `src/entrypoints/content/hnenhancer.js:1713`
- **Suggestion:** Add a null check for the parent comment before accessing its path, and handle orphaned comments gracefully (e.g., treat them as top-level or skip them).

### IMP-039 — `window.location.search` parsing is fragile for item IDs
- **Problem:** `getCurrentHNItemId()` uses a simple regex match on the search string. This could fail if the URL has additional parameters before `id=` or uses different encoding.
- **Where:** `src/entrypoints/content/hnenhancer.js:1393`
- **Suggestion:** Use `URLSearchParams` for more robust URL parameter parsing: `new URLSearchParams(window.location.search).get('id')`.