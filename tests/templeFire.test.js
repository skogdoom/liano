import { describe, it, expect } from 'vitest';
import { darknessOf } from '../src/views/obstacles.js';
import { STAGE_TINTS } from '../src/views/backdrop.js';

describe('temple fires', () => {
  it('measures how dark a stage is from its tint: none by day, most at night', () => {
    const [day, late, dusk, night, dawn] = STAGE_TINTS.map(darknessOf);
    expect(day).toBe(0);
    expect(night).toBeGreaterThan(0.9);
    expect(dusk).toBeGreaterThan(late);
    expect(night).toBeGreaterThan(dusk);
    expect(dawn).toBeLessThan(dusk);
    expect(late).toBeGreaterThan(0);
  });
});
