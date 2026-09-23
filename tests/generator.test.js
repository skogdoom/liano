import { describe, it, expect } from 'vitest';
import { createLiana, lianaIndexRange, updateLianas } from '../src/sim/generator.js';
import { LIANA_SPACING, SCREEN_WIDTH, CAMERA_TARGET_X, WORLD_MARGIN } from '../src/config.js';

describe('liana generation', () => {
  it('places liana i at i · LIANA_SPACING', () => {
    expect(createLiana(0).x).toBe(0);
    expect(createLiana(7).x).toBe(7 * LIANA_SPACING);
    expect(createLiana(-3).x).toBe(-3 * LIANA_SPACING);
  });

  it.each([0, 123.4, -5000, 250000])('covers the view plus the margin on both sides (x = %d)', (x) => {
    const { first, last } = lianaIndexRange(x);
    const viewLeft = x - CAMERA_TARGET_X;
    const viewRight = viewLeft + SCREEN_WIDTH;
    expect(first * LIANA_SPACING).toBeGreaterThanOrEqual(viewLeft - WORLD_MARGIN);
    expect((first - 1) * LIANA_SPACING).toBeLessThan(viewLeft - WORLD_MARGIN);
    expect(last * LIANA_SPACING).toBeLessThanOrEqual(viewRight + WORLD_MARGIN);
    expect((last + 1) * LIANA_SPACING).toBeGreaterThan(viewRight + WORLD_MARGIN);
  });

  it('adds lianas that come into range and removes those far out of range', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const initial = lianaIndexRange(0);
    expect([...lianas.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: initial.last - initial.first + 1 }, (_, k) => initial.first + k),
    );

    const far = 50 * SCREEN_WIDTH;
    updateLianas(lianas, far, null);
    const range = lianaIndexRange(far);
    for (const i of lianas.keys()) {
      expect(i).toBeGreaterThanOrEqual(range.first);
      expect(i).toBeLessThanOrEqual(range.last);
    }
    expect(lianas.size).toBe(range.last - range.first + 1);
  });

  it('keeps lianas one spacing past the edge of the range (hysteresis)', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const leftmost = lianaIndexRange(0).first;
    const kept = lianas.get(leftmost);
    // Move right just enough for the leftmost liana to leave the generation range.
    const x = leftmost * LIANA_SPACING + CAMERA_TARGET_X + WORLD_MARGIN + 1;
    expect(lianaIndexRange(x).first).toBe(leftmost + 1);
    updateLianas(lianas, x, null);
    expect(lianas.get(leftmost)).toBe(kept);
    // One more spacing and it goes.
    updateLianas(lianas, x + LIANA_SPACING, null);
    expect(lianas.has(leftmost)).toBe(false);
  });

  it('never removes the liana being held', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const held = lianas.get(0);
    updateLianas(lianas, 100 * SCREEN_WIDTH, held);
    expect(lianas.get(0)).toBe(held);
  });
});
