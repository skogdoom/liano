import { describe, it, expect } from 'vitest';
import { darknessOf } from '../src/views/obstacles.js';
import { STAGE_TINTS } from '../src/views/backdrop.js';
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

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

  it('keeps the cartoon light source opaque so the rig applies its falloff once', () => {
    const svg = readFileSync(new URL('../art/packs/cartoon/generated/temple.glow.svg', import.meta.url));
    const { pixels, width, height } = new Resvg(svg).render();
    const alphaAt = (x, y) => pixels[(y * width + x) * 4 + 3];
    expect(alphaAt(width / 2, height / 2)).toBe(255);
    expect(alphaAt(width / 2, height / 4)).toBe(255);
    expect(alphaAt(0, 0)).toBe(0);
  });
});
