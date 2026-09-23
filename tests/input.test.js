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
