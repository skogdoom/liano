import { describe, it, expect } from 'vitest';
import { leafPoints, mixColor } from '../src/render/shapes.js';

describe('shape helpers', () => {
  it('mixes colours per channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixColor(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixColor(0x102030, 0x304050, 0.5)).toBe(0x203040);
  });

  it('builds a leaf from its base to its tip along the angle', () => {
    const p = leafPoints(10, 20, Math.PI / 2, 30, 8);
    expect(p).toHaveLength(12);
    expect(p[0]).toBeCloseTo(10);
    expect(p[1]).toBeCloseTo(20);
    // Tip is the 4th point, straight down (+y) from the base.
    expect(p[6]).toBeCloseTo(10);
    expect(p[7]).toBeCloseTo(50);
  });
});
