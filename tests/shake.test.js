import { describe, it, expect } from 'vitest';
import { Shake } from '../src/render/shake.js';

describe('screen shake', () => {
  it('is still until triggered', () => {
    const shake = new Shake();
    shake.update(1 / 60);
    expect([shake.x, shake.y]).toEqual([0, 0]);
  });

  it('moves within the amplitude, decays, and stops after the duration', () => {
    const shake = new Shake();
    shake.trigger(10, 0.3);
    let moved = false;
    let early = 0;
    let late = 0;
    for (let i = 1; i <= 18; i++) {
      shake.update(1 / 60);
      const d = Math.hypot(shake.x, shake.y);
      expect(Math.abs(shake.x)).toBeLessThanOrEqual(10);
      expect(Math.abs(shake.y)).toBeLessThanOrEqual(10);
      if (d > 0) moved = true;
      if (i <= 6) early = Math.max(early, d);
      if (i >= 12) late = Math.max(late, d);
    }
    expect(moved).toBe(true);
    expect(late).toBeLessThan(early);
    shake.update(1 / 60);
    expect([shake.x, shake.y]).toEqual([0, 0]);
  });

  it('restarts when triggered again', () => {
    const shake = new Shake();
    shake.trigger(10, 0.2);
    for (let i = 0; i < 30; i++) shake.update(1 / 60);
    shake.trigger(10, 0.2);
    shake.update(1 / 60);
    expect(Math.hypot(shake.x, shake.y)).toBeGreaterThan(0);
  });
});
