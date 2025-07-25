# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# HN Companion Browser Extension

## Overview
Hacker News browser extension built with **WXT framework** providing AI-powered discussion summaries and Vim-style keyboard navigation. 
Supports Chrome and Firefox with Manifest V3.
## Features
- **AI Summaries**: Generates concise summaries of Hacker News discussions using multiple AI providers.
- **Keyboard Navigation**: Vim-style shortcuts for comment and post navigation. Quick-jump between comments by the same author (`[`,`]`)

## Package Manager
Use `pnpm` (version 10.2.0+ required per packageManager field).

## Build Commands
- **Development**: `pnpm run dev` (Chrome) or `pnpm run dev:firefox`
- **Production Build**: `pnpm run build` (Chrome) or `pnpm run build:firefox`
- **Package**: `pnpm run zip` or `pnpm run zip:firefox`

## Architecture

### WXT Framework Structure
- **Entrypoints**: `src/entrypoints/` contains background, content, and options scripts
- **Configuration**: `wxt.config.ts` handles build, Tailwind, and manifest generation
- **Cross-browser**: WXT automatically handles Chrome/Firefox differences

### Key Components
- **HNEnhancer class** (`content/hnenhancer.js`): Core functionality engine
- **AI Integration** (`lib/llm-summarizer.js`): Multi-provider abstraction using Vercel AI SDK
- **Summary Panel** (`content/summary-panel.js`): Resizable UI component
- **Options Page** (`entrypoints/options/`): Extension settings with provider selection

### AI Provider Support
Multiple providers via Vercel AI SDK: OpenAI, Anthropic, Google AI, OpenRouter, Ollama.

### State Management
- **Settings**: chrome.storage.sync for user preferences
- **Navigation**: Local state with undo functionality
- **Comment Maps**: Author-to-comment tracking for quick navigation

## Code Style
- **ES Modules** throughout (type: "module")
- **camelCase** variables/functions, **PascalCase** classes
- **4-space indentation**, semicolons required
- **Async/await** preferred over raw promises
- **Try/catch** with specific error messages

## Development Notes
- Use `HNEnhancer.DEBUG = true` for development logging
- Extension works on `news.ycombinator.com` and related domains
- Content script injection handles progressive enhancement
- Background script is a service worker (Manifest V3)