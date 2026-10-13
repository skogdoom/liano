import { describe, expect, it } from 'vitest';
import { BackdropMotion } from '../src/phaser/world/backdropMotion.js';

describe('Phaser scenery motion', () => {
  it('approaches a stationary target monotonically without overshooting', () => {
    for (const target of [-100, 100]) {
      const motion = new BackdropMotion();
      let distance = Math.abs(target);
      for (let i = 0; i < 120; i++) {
        motion.update(target, 1 / 120);
        const next = Math.abs(target - motion.x);
        expect(next).toBeLessThanOrEqual(distance);
        expect(Math.sign(target - motion.x)).toBe(Math.sign(target));
        distance = next;
      }
      expect(motion.x).toBeCloseTo(target, 5);
    }
  });

  it('does not turn a target jump into an immediate position jump', () => {
    const motion = new BackdropMotion();
    motion.mark();
    motion.update(100, 1 / 120);
    expect(motion.prevX).toBe(0);
    expect(motion.x).toBeGreaterThan(0);
    expect(motion.x).toBeLessThan(2);
  });

  it('gives the same stationary-target result with different step sizes', () => {
    const once = new BackdropMotion();
    const many = new BackdropMotion();
    once.update(100, 0.5);
    for (let i = 0; i < 60; i++) many.update(100, 1 / 120);
    expect(many.x).toBeCloseTo(once.x, 9);
    expect(many.velocity).toBeCloseTo(once.velocity, 9);
  });

  it('retains a steady pan speed with bounded lag', () => {
    const motion = new BackdropMotion();
    for (let i = 1; i <= 240; i++) motion.update(i * 5, 1 / 120);
    const before = motion.x;
    motion.update(1205, 1 / 120);
    expect(motion.x - before).toBeCloseTo(5, 9);
    expect(1205 - motion.x).toBeLessThan(50);
  });

  it('holds while paused and discards momentum on a new world or resize', () => {
    const motion = new BackdropMotion();
    motion.update(100, 1 / 120);
    const before = [motion.x, motion.velocity];
    motion.update(100, 0);
    expect([motion.x, motion.velocity]).toEqual(before);
    motion.reset(-500);
    expect([motion.prevX, motion.x, motion.velocity]).toEqual([-500, -500, 0]);
    motion.update(-500, 1 / 120);
    expect(motion.x).toBe(-500);
  });
});
