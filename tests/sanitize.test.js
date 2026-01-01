import { test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

// Set up DOM environment for DOMPurify
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

// Import after setting up globals
const { sanitizeHtml, sanitizeHtmlToFragment, enforceSafeLinks } = await import('../src/lib/sanitize.js');

// ============================================================================
// sanitizeHtml tests
// ============================================================================

test('sanitizeHtml: removes script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    assert.ok(!result.includes('<script'), 'Script tag should be removed');
    assert.ok(result.includes('<p>Hello</p>'), 'Safe content should be preserved');
});

test('sanitizeHtml: removes event handlers', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    assert.ok(!result.includes('onerror'), 'Event handler should be removed');
});

test('sanitizeHtml: preserves allowed tags', () => {
    const input = '<p>Text with <strong>bold</strong> and <em>italic</em></p>';
    const result = sanitizeHtml(input);
    assert.ok(result.includes('<p>'), 'p tag should be preserved');
    assert.ok(result.includes('<strong>'), 'strong tag should be preserved');
    assert.ok(result.includes('<em>'), 'em tag should be preserved');
});

test('sanitizeHtml: preserves allowed attributes', () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    const result = sanitizeHtml(input);
    assert.ok(result.includes('href="https://example.com"'), 'href should be preserved');
    assert.ok(result.includes('target="_blank"'), 'target should be preserved');
});

test('sanitizeHtml: removes dangerous tags', () => {
    const input = '<iframe src="evil.com"></iframe><object data="x"></object>';
    const result = sanitizeHtml(input);
    assert.ok(!result.includes('<iframe'), 'iframe should be removed');
    assert.ok(!result.includes('<object'), 'object should be removed');
});

test('sanitizeHtml: preserves data attributes for comments', () => {
    const input = '<a data-comment-link="true" data-comment-id="123">Comment</a>';
    const result = sanitizeHtml(input);
    assert.ok(result.includes('data-comment-link'), 'data-comment-link should be preserved');
    assert.ok(result.includes('data-comment-id'), 'data-comment-id should be preserved');
});

test('sanitizeHtml: removes unallowed data attributes', () => {
    const input = '<div data-evil="payload">Text</div>';
    const result = sanitizeHtml(input);
    assert.ok(!result.includes('data-evil'), 'Unallowed data attribute should be removed');
});

// ============================================================================
// sanitizeHtmlToFragment tests
// ============================================================================

test('sanitizeHtmlToFragment: returns DocumentFragment', () => {
    const input = '<p>Hello</p>';
    const result = sanitizeHtmlToFragment(input);
    assert.ok(result instanceof dom.window.DocumentFragment, 'Should return DocumentFragment');
});

test('sanitizeHtmlToFragment: content is sanitized', () => {
    const input = '<p>Safe</p><script>evil()</script>';
    const result = sanitizeHtmlToFragment(input);
    const div = document.createElement('div');
    div.appendChild(result.cloneNode(true));
    assert.ok(!div.innerHTML.includes('<script'), 'Script should be removed from fragment');
    assert.ok(div.innerHTML.includes('<p>Safe</p>'), 'Safe content should be in fragment');
});

// ============================================================================
// enforceSafeLinks tests
// ============================================================================

test('enforceSafeLinks: removes javascript: protocol', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="javascript:alert(1)">Click</a>';
    enforceSafeLinks(container);
    const link = container.querySelector('a');
    assert.ok(!link.hasAttribute('href'), 'javascript: href should be removed');
});

test('enforceSafeLinks: preserves http: and https: protocols', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="https://example.com">HTTPS</a><a href="http://example.com">HTTP</a>';
    enforceSafeLinks(container);
    const links = container.querySelectorAll('a');
    assert.strictEqual(links[0].getAttribute('href'), 'https://example.com', 'https should be preserved');
    assert.strictEqual(links[1].getAttribute('href'), 'http://example.com', 'http should be preserved');
});

test('enforceSafeLinks: preserves mailto: protocol', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="mailto:test@example.com">Email</a>';
    enforceSafeLinks(container);
    const link = container.querySelector('a');
    assert.strictEqual(link.getAttribute('href'), 'mailto:test@example.com', 'mailto should be preserved');
});

test('enforceSafeLinks: adds rel="noopener noreferrer" to target="_blank" links', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="https://example.com" target="_blank">Link</a>';
    enforceSafeLinks(container);
    const link = container.querySelector('a');
    assert.strictEqual(link.getAttribute('rel'), 'noopener noreferrer', 'rel should be set');
});

test('enforceSafeLinks: preserves hash links', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="#section">Jump</a>';
    enforceSafeLinks(container);
    const link = container.querySelector('a');
    assert.strictEqual(link.getAttribute('href'), '#section', 'Hash link should be preserved');
});

test('enforceSafeLinks: removes data: protocol', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="data:text/html,<script>alert(1)</script>">Data</a>';
    enforceSafeLinks(container);
    const link = container.querySelector('a');
    assert.ok(!link.hasAttribute('href'), 'data: href should be removed');
});

test('enforceSafeLinks: handles invalid URLs', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="::invalid::">Invalid</a>';
    enforceSafeLinks(container);
    const link = container.querySelector('a');
    assert.ok(!link.hasAttribute('href'), 'Invalid URL href should be removed');
});

test('enforceSafeLinks: handles empty href', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a href="">Empty</a>';
    enforceSafeLinks(container);
    const link = container.querySelector('a');
    // Empty href is valid (relative to current page)
    assert.ok(link.hasAttribute('href'), 'Empty href should be preserved');
});

test('enforceSafeLinks: handles missing href', () => {
    const container = document.createElement('div');
    container.innerHTML = '<a>No href</a>';
    enforceSafeLinks(container);
    const link = container.querySelector('a');
    assert.ok(!link.hasAttribute('href'), 'Link without href should remain unchanged');
});
