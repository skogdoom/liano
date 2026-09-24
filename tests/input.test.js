import { describe, it, expect } from 'vitest';
import { createInput } from '../src/input.js';

function keydown(target, props) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { repeat: false, ...props });
  target.dispatchEvent(event);
  return event;
}

describe('input', () => {
  it('queues a single Space press until consumed', () => {
    const target = new EventTarget();
    const input = createInput(target);
    keydown(target, { code: 'Space' });
    expect(input.consumePress()).toBe(true);
    expect(input.consumePress()).toBe(false);
  });

  it('ignores key auto-repeat', () => {
    const target = new EventTarget();
    const input = createInput(target);
    keydown(target, { code: 'Space' });
    input.consumePress();
    keydown(target, { code: 'Space', repeat: true });
    keydown(target, { code: 'Space', repeat: true });
    expect(input.consumePress()).toBe(false);
  });

  it('ignores other keys', () => {
    const target = new EventTarget();
    const input = createInput(target);
    keydown(target, { code: 'Enter' });
    keydown(target, { code: 'KeyA' });
    expect(input.consumePress()).toBe(false);
  });

  it('prevents default on Space, including repeats', () => {
    const target = new EventTarget();
    createInput(target);
    expect(keydown(target, { code: 'Space' }).defaultPrevented).toBe(true);
    expect(keydown(target, { code: 'Space', repeat: true }).defaultPrevented).toBe(true);
    expect(keydown(target, { code: 'Enter' }).defaultPrevented).toBe(false);
  });

  it('stops listening after destroy', () => {
    const target = new EventTarget();
    const input = createInput(target);
    input.destroy();
    keydown(target, { code: 'Space' });
    expect(input.consumePress()).toBe(false);
  });
});

describe('debug toggle', () => {
  it('toggles on D, ignoring repeats', () => {
    const target = new EventTarget();
    const input = createInput(target);
    expect(input.consumeDebugToggle()).toBe(false);
    keydown(target, { code: 'KeyD' });
    keydown(target, { code: 'KeyD', repeat: true });
    expect(input.consumeDebugToggle()).toBe(true);
    expect(input.consumeDebugToggle()).toBe(false);
  });

  it('cancels out two presses within one frame and does not affect Space', () => {
    const target = new EventTarget();
    const input = createInput(target);
    keydown(target, { code: 'KeyD' });
    keydown(target, { code: 'KeyD' });
    expect(input.consumeDebugToggle()).toBe(false);
    expect(input.consumePress()).toBe(false);
  });
});

function pointerdown(target, props) {
  const event = Object.assign(new Event('pointerdown', { cancelable: true }), { button: 0, ...props });
  target.dispatchEvent(event);
  return event;
}

describe('pointer input', () => {
  it('counts a tap as a press and prevents the default action', () => {
    const canvas = new EventTarget();
    const input = createInput(new EventTarget(), canvas);
    const event = pointerdown(canvas, { pointerType: 'touch' });
    expect(event.defaultPrevented).toBe(true);
    expect(input.consumePress()).toBe(true);
    expect(input.consumePress()).toBe(false);
  });

  it('counts each new finger, and the primary mouse button, but not other buttons', () => {
    const canvas = new EventTarget();
    const input = createInput(new EventTarget(), canvas);
    pointerdown(canvas, { pointerType: 'touch' });
    input.consumePress();
    pointerdown(canvas, { pointerType: 'touch' });
    expect(input.consumePress()).toBe(true);
    pointerdown(canvas, { pointerType: 'mouse', button: 2 });
    expect(input.consumePress()).toBe(false);
    pointerdown(canvas, { pointerType: 'mouse', button: 0 });
    expect(input.consumePress()).toBe(true);
  });

  it('remembers the input type used last', () => {
    const win = new EventTarget();
    const canvas = new EventTarget();
    const input = createInput(win, canvas, { initialType: 'touch' });
    expect(input.lastType).toBe('touch');
    keydown(win, { code: 'Space' });
    expect(input.lastType).toBe('keyboard');
    pointerdown(canvas, { pointerType: 'mouse' });
    expect(input.lastType).toBe('mouse');
    pointerdown(canvas, { pointerType: 'pen' });
    expect(input.lastType).toBe('touch');
    keydown(win, { code: 'KeyD' });
    expect(input.lastType).toBe('touch');
  });

  it('drops presses that accepts() rejects, but still tracks the input type', () => {
    const win = new EventTarget();
    const canvas = new EventTarget();
    let open = false;
    const input = createInput(win, canvas, { accepts: () => open });
    pointerdown(canvas, { pointerType: 'touch' });
    keydown(win, { code: 'Space' });
    expect(input.consumePress()).toBe(false);
    expect(input.lastType).toBe('keyboard');
    open = true;
    pointerdown(canvas, { pointerType: 'touch' });
    expect(input.consumePress()).toBe(true);
  });

  it('works without a pointer target and stops listening after destroy', () => {
    expect(() => createInput(new EventTarget()).destroy()).not.toThrow();
    const canvas = new EventTarget();
    const input = createInput(new EventTarget(), canvas);
    input.destroy();
    pointerdown(canvas, { pointerType: 'touch' });
    expect(input.consumePress()).toBe(false);
  });
});

describe('mute toggle and on-screen buttons', () => {
  it('toggles mute on M, ignoring repeats, separately from D', () => {
    const win = new EventTarget();
    const input = createInput(win);
    keydown(win, { code: 'KeyM' });
    keydown(win, { code: 'KeyM', repeat: true });
    keydown(win, { code: 'KeyD' });
    expect(input.consumeMuteToggle()).toBe(true);
    expect(input.consumeMuteToggle()).toBe(false);
    expect(input.consumeDebugToggle()).toBe(true);
    expect(input.consumePress()).toBe(false);
  });

  it('lets intercept() swallow a tap, e.g. on the mute button', () => {
    const canvas = new EventTarget();
    const seen = [];
    const input = createInput(new EventTarget(), canvas, {
      intercept: (event) => {
        seen.push(event.clientX);
        return event.clientX < 50;
      },
    });
    const onButton = pointerdown(canvas, { pointerType: 'touch', clientX: 10 });
    expect(onButton.defaultPrevented).toBe(true);
    expect(input.consumePress()).toBe(false);
    pointerdown(canvas, { pointerType: 'touch', clientX: 400 });
    expect(input.consumePress()).toBe(true);
    expect(seen).toEqual([10, 400]);
  });
});

describe('input edge cases', () => {
  it('holding Space through a death does not restart the game', async () => {
    const { Game, GameState } = await import('../src/sim/game.js');
    const { emptyWorld, FALL_RELEASE_STEP } = await import('./helpers.js');
    const { SIM_DT, GAMEOVER_INPUT_LOCK_MS } = await import('../src/config.js');
    const win = new EventTarget();
    const input = createInput(win);
    const game = new Game({ createWorld: emptyWorld });
    const frame = (steps = 1) => {
      for (let i = 0; i < steps; i++) {
        if (input.consumePress()) game.press();
        game.step(SIM_DT);
      }
    };
    keydown(win, { code: 'Space' }); // start
    frame(FALL_RELEASE_STEP);
    keydown(win, { code: 'Space' }); // release into a fall, then keep holding
    for (let i = 0; i < 600 && game.state === GameState.PLAYING; i++) {
      keydown(win, { code: 'Space', repeat: true });
      frame();
    }
    expect(game.state).toBe(GameState.GAME_OVER);
    for (let i = 0; i < (2 * GAMEOVER_INPUT_LOCK_MS) / 1000 / SIM_DT; i++) {
      keydown(win, { code: 'Space', repeat: true });
      frame();
    }
    expect(game.state).toBe(GameState.GAME_OVER);
    keydown(win, { code: 'Space' }); // a fresh press restarts
    frame();
    expect(game.state).toBe(GameState.PLAYING);
  });

  it('counts two fingers landing in the same step as one press', () => {
    const canvas = new EventTarget();
    const input = createInput(new EventTarget(), canvas);
    pointerdown(canvas, { pointerType: 'touch' });
    pointerdown(canvas, { pointerType: 'touch' });
    expect(input.consumePress()).toBe(true);
    expect(input.consumePress()).toBe(false);
  });

  it('a key held while the window loses and regains focus does not press', () => {
    const win = new EventTarget();
    const input = createInput(win);
    keydown(win, { code: 'Space' });
    input.consumePress();
    win.dispatchEvent(new Event('blur'));
    win.dispatchEvent(new Event('focus'));
    keydown(win, { code: 'Space', repeat: true }); // the browser keeps repeating the held key
    expect(input.consumePress()).toBe(false);
  });
});
