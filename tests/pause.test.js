import { describe, it, expect } from 'vitest';
import { createFocusPause } from '../src/pause.js';

function fakeDocument(visibilityState = 'visible') {
  const doc = new EventTarget();
  doc.visibilityState = visibilityState;
  return doc;
}

function setVisibility(doc, state) {
  doc.visibilityState = state;
  doc.dispatchEvent(new Event('visibilitychange'));
}

describe('focus pause', () => {
  it('starts unpaused on a visible page', () => {
    expect(createFocusPause(new EventTarget(), fakeDocument()).paused).toBe(false);
  });

  it('starts paused on a hidden page', () => {
    expect(createFocusPause(new EventTarget(), fakeDocument('hidden')).paused).toBe(true);
  });

  it('pauses on window blur and resumes on focus', () => {
    const win = new EventTarget();
    const pause = createFocusPause(win, fakeDocument());
    win.dispatchEvent(new Event('blur'));
    expect(pause.paused).toBe(true);
    win.dispatchEvent(new Event('focus'));
    expect(pause.paused).toBe(false);
  });

  it('pauses while the page is hidden', () => {
    const doc = fakeDocument();
    const pause = createFocusPause(new EventTarget(), doc);
    setVisibility(doc, 'hidden');
    expect(pause.paused).toBe(true);
    setVisibility(doc, 'visible');
    expect(pause.paused).toBe(false);
  });

  it('stays paused until both focus and visibility are back', () => {
    const win = new EventTarget();
    const doc = fakeDocument();
    const pause = createFocusPause(win, doc);
    win.dispatchEvent(new Event('blur'));
    setVisibility(doc, 'hidden');
    setVisibility(doc, 'visible');
    expect(pause.paused).toBe(true);
    win.dispatchEvent(new Event('focus'));
    expect(pause.paused).toBe(false);
  });

  it('stops listening after destroy', () => {
    const win = new EventTarget();
    const pause = createFocusPause(win, fakeDocument());
    pause.destroy();
    win.dispatchEvent(new Event('blur'));
    expect(pause.paused).toBe(false);
  });
});
