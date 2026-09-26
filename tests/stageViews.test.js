import { describe, it, expect } from 'vitest';
import { bannerAlpha, STAGE_NAMES } from '../src/render/overlays.js';
import { tintBetween, STAGE_TINTS } from '../src/render/background.js';
import { STAGES } from '../src/config.js';

describe('stage banner and tint', () => {
  it('fades the banner in, holds it and fades it out', () => {
    expect(bannerAlpha(0)).toBe(0);
    expect(bannerAlpha(0.15)).toBeCloseTo(0.5, 9);
    expect(bannerAlpha(1)).toBe(1);
    expect(bannerAlpha(2.2)).toBeGreaterThan(0);
    expect(bannerAlpha(2.2)).toBeLessThan(1);
    expect(bannerAlpha(2.5)).toBe(0);
    expect(bannerAlpha(Infinity)).toBe(0);
  });

  it('has a name and a tint per stage, darkening towards night', () => {
    expect(STAGE_NAMES).toHaveLength(STAGES.length);
    expect(STAGE_TINTS).toHaveLength(STAGES.length);
    const brightness = (c) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    for (let i = 1; i < STAGE_TINTS.length; i++) {
      expect(brightness(STAGE_TINTS[i])).toBeLessThan(brightness(STAGE_TINTS[i - 1]));
    }
  });

  it('eases the tint from one stage to the next', () => {
    const [day, late] = STAGE_TINTS;
    expect(tintBetween(day, late, 0)).toBe(day);
    expect(tintBetween(day, late, 1)).toBe(late);
    expect(tintBetween(day, late, 2)).toBe(late);
    const mid = tintBetween(day, late, 0.5);
    expect(mid).not.toBe(day);
    expect(mid).not.toBe(late);
  });
});
