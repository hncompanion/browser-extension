# Architecture Overview
This document describes the modular architecture of the HN Companion content script codebase.

## Module Structure

```
src/
├── entrypoints/
│   └── content/
│       ├── hnenhancer.js          # Main orchestrator
│       ├── ai-summarizer.js       # AI provider logic
│       ├── comment-navigator.js   # Comment navigation state
│       ├── comment-processor.js   # Comment parsing/enrichment
│       ├── help-modal.js          # Help UI component
│       ├── hn-dom-utils.js        # HN-specific DOM helpers
│       ├── keyboard-shortcuts.js  # Keyboard handling
│       ├── user-popup.js          # User info popup
│       ├── summary-panel.js       # Summary panel UI component
│       ├── hnstate.js             # Persistent state management
│       └── constants.js           # AI prompts and configuration
│
└── lib/
    ├── dom-utils.js               # Generic DOM utilities
    ├── text-utils.js              # Text processing utilities
    ├── utils.js                   # Logger and general utilities
    ├── messaging.js               # Background script communication
    └── sanitize.js                # HTML sanitization
```

## Module Responsibilities

### Core Orchestrator

**`hnenhancer.js`** - Main entry point and coordinator
- Initializes all modules on page load
- Detects page type (home vs comments page)
- Wires up handlers between modules
- Delegates to specialized modules for all major functionality

### Feature Modules

**`ai-summarizer.js`** - AI summarization logic
- Provider configuration (OpenAI, Anthropic, Google, OpenRouter, Ollama)
- Model-specific token limits and parameters
- Summarization request handling and error formatting
- Server cache integration

**`comment-navigator.js`** - Comment focus and traversal
- `CommentNavigator` class for navigation state
- Current comment tracking with visual highlighting
- Navigation history for undo functionality
- Author-based comment jumping
- Click handlers for comment focus

**`comment-processor.js`** - Comment data processing
- Fetches comments from HN Algolia API
- Merges API data with DOM-extracted metadata (position, downvotes)
- Calculates comment paths (e.g., "1.2.3" for nested replies)
- Converts markdown summaries to interactive DOM fragments
- Replaces comment references with navigation anchors

**`keyboard-shortcuts.js`** - Keyboard event handling
- Page-specific shortcut definitions (home page vs comments page)
- Global shortcuts (help modal, navigation)
- Double-key combinations (e.g., "gg" for first item)
- Input field detection to prevent shortcut conflicts

**`help-modal.js`** - Help UI component
- Shortcut group definitions
- Modal DOM creation and styling
- Toggle visibility logic

**`user-popup.js`** - User information popup
- Hover detection on usernames
- User info fetching with caching
- Popup positioning and display

### Utility Modules

**`hn-dom-utils.js`** - HN-specific DOM helpers
- Author highlighting elements
- Comment navigation anchors
- Loading message components

**`lib/dom-utils.js`** - Generic DOM utilities
- Fragment building from mixed node/text arrays
- Element creation helpers (strong, links)
- HTML entity decoding

**`lib/text-utils.js`** - Text processing
- Anchor tag stripping
- Token-based text truncation for AI context limits

## Data Flow

### Summarization Flow

```
User clicks "summarize"
    → hnenhancer.js receives event
    → comment-processor.js fetches and formats comments
    → ai-summarizer.js sends to AI provider
    → comment-processor.js converts markdown response to DOM
    → summary-panel.js displays result
```

### Navigation Flow

```
User presses navigation key
    → keyboard-shortcuts.js handles keydown
    → Calls appropriate handler on hnenhancer.js
    → hnenhancer.js delegates to comment-navigator.js
    → comment-navigator.js updates state and scrolls
```

## Design Principles

1. **Single Responsibility**: Each module handles one concern
2. **Explicit Dependencies**: Modules import only what they need
3. **Thin Orchestrator**: `hnenhancer.js` coordinates but doesn't implement
4. **Separation of Concerns**:
   - HN-specific code in `content/`
   - Reusable utilities in `lib/`
5. **Stateless Utilities**: Utility functions are pure where possible
6. **Class for Stateful Components**: `CommentNavigator` manages mutable navigation state

## Adding New Features

1. **New keyboard shortcut**: Add to `keyboard-shortcuts.js`, wire handler in `hnenhancer.js`
2. **New AI provider**: Add configuration to `ai-summarizer.js`
3. **New UI component**: Create new module, import in `hnenhancer.js`
4. **New utility function**: Add to appropriate `lib/` module or create new one
