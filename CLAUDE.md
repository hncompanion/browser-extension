# HN Enhancer - Developer Guide

# Overview
Hacker News Browser extension that enables keyboard navigation and AI summaries. 
This extension is build using [wxt](https://wxt.dev/guide/installation.html). 

# Key Features
- Keyboard Navigation - Vim-inspired shortcuts (`h`, `j`, `k`, `l`)
  - Quick-jump between comments by the same author (`[`,`]`)
- Discussion thread Summarization using AI
  - Multiple AI provider options (OpenAI, Anthropic, OpenRouter, Ollama)
- User profile previews on hover

## Package Manager
- Use `pnpm` for package management.

## Build Commands
- Development build: `pnpm run dev-build`
- Watch mode: `pnpm run dev`
- Release build: `pnpm run release-build`
- Build Tailwind: `pnpm run build:tailwind`
- Build Tailwind (watch): `pnpm run build:tailwind:watch`

## Test Commands
- Run all tests: `pnpm run test`
- Run specific test: `NODE_OPTIONS=--experimental-vm-modules jest scripts/example.test.js`

## Scripts
- Download post IDs: `pnpm run download-post-ids`
- Download posts: `pnpm run download-posts`
- Generate LLM summary: `pnpm run generate-llm-summary`

## Code Style Guidelines
- **Module System**: ES Modules (import/export)
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Error Handling**: Try/catch blocks with specific error messages
- **Testing**: Jest with expect assertions, descriptive test names
- **Formatting**: 4-space indentation, semicolons required
- **Comments**: Document complex logic, avoid obvious comments
- **File Structure**: Modular design with separate concerns (options, background, content)
- **Promises**: Async/await preferred over raw promises
- **Browser Extension**: Follow Chrome/Firefox extension best practices