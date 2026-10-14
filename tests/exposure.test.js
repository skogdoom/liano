import { describe, expect, it } from 'vitest';
import { exposureWidth } from '../src/phaser/world/exposure.js';

describe('Phaser scenery exposure', () => {
  it('covers the frame travel in either direction', () => {
    expect(exposureWidth(3, 2, 1 / 60)).toBe(3);
    expect(exposureWidth(-3, 2, 1 / 60)).toBe(3);
  });

  it('caps blur in screen pixels across different view scales', () => {
    for (const density of [0.5, 1, 2, 3]) expect(exposureWidth(100, density, 1 / 60) * density).toBe(8);
  });

  it('leaves still frames, pauses, stalls and zero-sized views sharp', () => {
    expect(exposureWidth(0, 2, 1 / 60)).toBe(0);
    expect(exposureWidth(3, 2, 0)).toBe(0);
    expect(exposureWidth(300, 2, 0.1)).toBe(0);
    expect(exposureWidth(3, 0, 1 / 60)).toBe(0);
    expect(exposureWidth(0.1, 2, 1 / 60)).toBe(0);
  });
});
