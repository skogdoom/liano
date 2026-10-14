import { describe, it, expect } from 'vitest';
import { createInput } from '../src/input.js';
import { phaserKeys, phaserPointers, pointerEvent } from '../src/phaser/input.js';
import { ConfigMenu } from '../src/phaser/configMenu.js';

// A Phaser event emitter (on, off, emit), enough for the keyboard and input plugins.
function emitter() {
  const listeners = new Map();
  return {
    on: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    off: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn)),
    emit: (type, ...args) => (listeners.get(type) ?? []).forEach((fn) => fn(...args)),
    count: (type) => (listeners.get(type) ?? []).length,
  };
}

const key = (code, repeat = false) => Object.assign(new Event('keydown', { cancelable: true }), { code, repeat });

describe('Phaser keys for the game input', () => {
  it('passes each key press on once, though Phaser hands the frame’s events again', () => {
    const keyboard = emitter();
    const input = createInput(phaserKeys(keyboard));
    const p1 = key('KeyP');
    const p2 = key('KeyP');
    // Two presses in one frame: Phaser emits the first, then the first and the second.
    keyboard.emit('keydown', p1);
    keyboard.emit('keydown', p1);
    keyboard.emit('keydown', p2);
    expect(input.consumePauseToggle()).toBe(false); // pressed twice: back where it was
    keyboard.emit('keydown', key('KeyP'));
    expect(input.consumePauseToggle()).toBe(true);
  });

  it('keeps the input rules: repeats ignored, Space kept from scrolling', () => {
    const keyboard = emitter();
    const input = createInput(phaserKeys(keyboard));
    const space = key('Space');
    keyboard.emit('keydown', space);
    keyboard.emit('keydown', key('Space', true));
    expect(space.defaultPrevented).toBe(true);
    expect(input.consumePress()).toBe(true);
    expect(input.consumePress()).toBe(false);
  });

  it('stops listening when destroyed', () => {
    const keyboard = emitter();
    const keys = phaserKeys(keyboard);
    createInput(keys).destroy();
    keys.destroy();
    expect(keyboard.count('keydown')).toBe(0);
  });

  it('intercepts each submenu key once before game mode/start input', () => {
    const keyboard = emitter(), game = { state: 'TITLE' }, selected = [];
    const menu = new ConfigMenu('auto', { apply: (choice) => selected.push(choice) });
    const input = createInput(phaserKeys(keyboard, {
      intercept: (event) => menu.interceptKey(event, game, true),
    }));
    menu.clear = () => input.clear();
    keyboard.emit('keydown', key('Space')); // queued before C in the same frame
    const c = key('KeyC');
    keyboard.emit('keydown', c);
    keyboard.emit('keydown', c); // Phaser replays the same event
    keyboard.emit('keydown', key('Space'));
    expect(menu.open).toBe(true);
    expect(input.consumePress()).toBe(false);
    const choice = key('Digit2');
    keyboard.emit('keydown', choice);
    keyboard.emit('keydown', choice);
    expect(selected).toEqual(['1.5']);
    expect(input.consumeModePick()).toBe(null);
  });
});

// A Phaser pointer for a mouse button or a finger.
function mouse(button = 0, at = [10, 20]) {
  const native = Object.assign(new Event('mousedown', { cancelable: true }), { clientX: at[0], clientY: at[1] });
  return { id: 1, wasTouch: false, button, event: native };
}
function finger(identifier, at) {
  const native = Object.assign(new Event('touchstart', { cancelable: true }), {
    changedTouches: [
      { identifier: identifier + 10, clientX: 0, clientY: 0 },
      { identifier, clientX: at[0], clientY: at[1] },
    ],
  });
  return { id: 2, wasTouch: true, button: 0, identifier, event: native };
}

describe('Phaser pointers for the game input', () => {
  it('describes a mouse press and a finger as pointer events', () => {
    expect(pointerEvent(mouse(0, [5, 6]))).toMatchObject({ pointerType: 'mouse', button: 0, pointerId: 1, clientX: 5, clientY: 6 });
    expect(pointerEvent(finger(3, [70, 80]))).toMatchObject({ pointerType: 'touch', pointerId: 2, clientX: 70, clientY: 80 });
  });

  it('counts a primary mouse button or a finger as a press, not other buttons', () => {
    const plugin = emitter();
    const input = createInput(new EventTarget(), phaserPointers(plugin), { initialType: 'keyboard' });
    plugin.emit('pointerdown', mouse(2));
    expect(input.consumePress()).toBe(false);
    plugin.emit('pointerdown', mouse(0));
    expect(input.consumePress()).toBe(true);
    expect(input.lastType).toBe('mouse');
    plugin.emit('pointerdown', finger(0, [1, 1]));
    expect(input.consumePress()).toBe(true);
    expect(input.lastType).toBe('touch');
  });

  it('lets a button take the tap, at its place on the page', () => {
    const plugin = emitter();
    const seen = [];
    const input = createInput(new EventTarget(), phaserPointers(plugin), {
      intercept: (event) => (seen.push([event.clientX, event.clientY]), event.clientX < 50),
    });
    plugin.emit('pointerdown', finger(0, [20, 30]));
    expect(input.consumePress()).toBe(false);
    plugin.emit('pointerdown', finger(1, [200, 30]));
    expect(input.consumePress()).toBe(true);
    expect(seen).toEqual([
      [20, 30],
      [200, 30],
    ]);
  });

  it('keeps the browser from acting on the press', () => {
    const plugin = emitter();
    createInput(new EventTarget(), phaserPointers(plugin));
    const pointer = mouse(0);
    plugin.emit('pointerdown', pointer);
    expect(pointer.event.defaultPrevented).toBe(true);
  });
});
