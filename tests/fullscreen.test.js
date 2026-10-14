import { describe, it, expect, vi } from 'vitest';
import { bindFullscreenControls } from '../src/fullscreen.js';
import { createInput } from '../src/input.js';

function keydown(target, props) {
  target.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { repeat: false, ...props }));
}

function pointer(target, type, { pointerId = 1, onButton = true } = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), { pointerId, pointerType: 'touch', button: 0, onButton });
  target.dispatchEvent(event);
}

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
