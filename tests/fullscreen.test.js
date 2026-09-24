import { describe, it, expect, vi } from 'vitest';
import { createFullscreen, bindFullscreenControls } from '../src/fullscreen.js';
import { createInput } from '../src/input.js';

// A document with the standard API, the webkit-prefixed one, or none (iPhone).
function fakeDocument(api = 'standard', { rejects = false } = {}) {
  const doc = new EventTarget();
  const root = {};
  doc.documentElement = root;
  let element = null;
  const set = (value, type) => {
    element = value;
    doc.dispatchEvent(new Event(type));
  };
  if (api === 'standard') {
    doc.fullscreenEnabled = true;
    Object.defineProperty(doc, 'fullscreenElement', { get: () => element });
    root.requestFullscreen = vi.fn(() => (rejects ? Promise.reject(new Error('denied')) : (set(root, 'fullscreenchange'), Promise.resolve())));
    doc.exitFullscreen = vi.fn(() => (set(null, 'fullscreenchange'), Promise.resolve()));
  } else if (api === 'webkit') {
    doc.webkitFullscreenEnabled = true;
    Object.defineProperty(doc, 'webkitFullscreenElement', { get: () => element });
    root.webkitRequestFullscreen = vi.fn(() => set(root, 'webkitfullscreenchange'));
    doc.webkitExitFullscreen = vi.fn(() => set(null, 'webkitfullscreenchange'));
  } else {
    doc.fullscreenEnabled = undefined;
  }
  return doc;
}

function keydown(target, props) {
  target.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { repeat: false, ...props }));
}

function pointer(target, type, { pointerId = 1, onButton = true } = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), { pointerId, pointerType: 'touch', button: 0, onButton });
  target.dispatchEvent(event);
}

describe('fullscreen', () => {
  it('enters and leaves with the standard API, reporting each change', () => {
    const doc = fakeDocument('standard');
    const onChange = vi.fn();
    const fs = createFullscreen(doc, { onChange });
    expect(fs.supported).toBe(true);
    fs.toggle();
    expect(doc.documentElement.requestFullscreen).toHaveBeenCalledOnce();
    expect(fs.active).toBe(true);
    fs.toggle();
    expect(doc.exitFullscreen).toHaveBeenCalledOnce();
    expect(fs.active).toBe(false);
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it('falls back to the webkit-prefixed API', () => {
    const doc = fakeDocument('webkit');
    const onChange = vi.fn();
    const fs = createFullscreen(doc, { onChange });
    expect(fs.supported).toBe(true);
    fs.toggle();
    expect(fs.active).toBe(true);
    fs.toggle();
    expect(fs.active).toBe(false);
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it('is unsupported without the API (iPhone Safari), and toggling does nothing', () => {
    const fs = createFullscreen(fakeDocument('none'));
    expect(fs.supported).toBe(false);
    expect(() => fs.toggle()).not.toThrow();
    expect(fs.active).toBe(false);
  });

  it('ignores a refused request', async () => {
    const doc = fakeDocument('standard', { rejects: true });
    const fs = createFullscreen(doc);
    fs.toggle();
    await Promise.resolve();
    expect(fs.active).toBe(false);
  });

  it('follows a change made outside the game (Esc)', () => {
    const doc = fakeDocument('standard');
    const onChange = vi.fn();
    const fs = createFullscreen(doc, { onChange });
    fs.toggle();
    doc.exitFullscreen(); // what the browser does on Esc
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(fs.active).toBe(false);
  });
});

describe('fullscreen controls', () => {
  function setup() {
    const fs = { toggle: vi.fn() };
    const keys = new EventTarget();
    const canvas = new EventTarget();
    bindFullscreenControls(keys, canvas, fs, { hit: (event) => event.onButton });
    return { fs, keys, canvas };
  }

  it('toggles on F, but not on repeats or browser shortcuts', () => {
    const { fs, keys } = setup();
    keydown(keys, { code: 'KeyF' });
    keydown(keys, { code: 'KeyF', repeat: true });
    keydown(keys, { code: 'KeyF', ctrlKey: true });
    keydown(keys, { code: 'KeyF', metaKey: true });
    keydown(keys, { code: 'KeyG' });
    expect(fs.toggle).toHaveBeenCalledOnce();
  });

  it('toggles when a tap on the button is released, not when it lands', () => {
    const { fs, canvas } = setup();
    pointer(canvas, 'pointerdown');
    expect(fs.toggle).not.toHaveBeenCalled();
    pointer(canvas, 'pointerup');
    expect(fs.toggle).toHaveBeenCalledOnce();
  });

  it('ignores a tap that starts or ends off the button, or is cancelled', () => {
    const { fs, canvas } = setup();
    pointer(canvas, 'pointerdown', { onButton: false });
    pointer(canvas, 'pointerup');
    pointer(canvas, 'pointerdown');
    pointer(canvas, 'pointerup', { onButton: false });
    pointer(canvas, 'pointerdown', { pointerId: 2 });
    pointer(canvas, 'pointercancel', { pointerId: 2 });
    pointer(canvas, 'pointerup', { pointerId: 2 });
    expect(fs.toggle).not.toHaveBeenCalled();
  });

  it('neither F nor a tap on the button is a game press', () => {
    const { fs, keys, canvas } = setup();
    const input = createInput(keys, canvas, { intercept: (event) => event.onButton });
    keydown(keys, { code: 'KeyF' });
    pointer(canvas, 'pointerdown');
    pointer(canvas, 'pointerup');
    expect(fs.toggle).toHaveBeenCalledTimes(2);
    expect(input.consumePress()).toBe(false);
  });
});
