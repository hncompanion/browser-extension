import { test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const { createHelpModal } = await import('../src/entrypoints/content/help-modal.js');

function click(target) {
    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
}

test('help modal: clicking the footer link is not cancelled', () => {
    const closeCalls = [];
    const modal = createHelpModal((show) => closeCalls.push(show));
    const link = modal.querySelector('.keyboard-help-footer a');
    assert.ok(link, 'footer link exists');

    const event = click(link);
    assert.strictEqual(event.defaultPrevented, false, 'link navigation must not be prevented');
    assert.deepStrictEqual(closeCalls, [], 'clicking inside the modal does not close it');
});

test('help modal: clicking the backdrop closes it', () => {
    const closeCalls = [];
    const modal = createHelpModal((show) => closeCalls.push(show));

    click(modal);
    assert.deepStrictEqual(closeCalls, [false]);
});
