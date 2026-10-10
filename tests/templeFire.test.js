import { describe, it, expect } from 'vitest';
import { ObstacleViews, darknessOf } from '../src/render/obstacleViews.js';
import { STAGE_TINTS } from '../src/render/background.js';
import { Obstacle, ObstacleType } from '../src/sim/obstacle.js';
import { TEMPLE_VARIANTS } from '../src/config.js';

const temple = (variant) => new Obstacle(3, ObstacleType.TEMPLE, 2450, 340, null, 1.3, null, variant, 1);

// The glow is the first child of the fire; its drawn circles are its context's instructions.
const fireOf = (views, o) => views.views.get(o).view.children.find((c) => c.untinted);
const glowCircles = (fire) => fire.children[0].context.instructions.length;

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

  it('keeps the fire out of the tint, and tints the stone, in the dark stages', () => {
    const o = temple(TEMPLE_VARIANTS - 1);
    const views = new ObstacleViews();
    views.update([o], 0, STAGE_TINTS[3]);
    const fire = fireOf(views, o);
    expect(fire).toBeDefined();
    expect(fire.tint).toBe(0xffffff);
    const stone = views.views.get(o).view.children.filter((c) => !c.untinted);
    expect(stone.length).toBeGreaterThan(0);
    for (const child of stone) expect(child.tint).toBe(STAGE_TINTS[3]);
  });

  it('lights up the stone round the braziers in the dark stages, and not by day', () => {
    const o = temple(TEMPLE_VARIANTS - 1);
    const views = new ObstacleViews();
    views.update([o], 0, STAGE_TINTS[0]);
    expect(glowCircles(fireOf(views, o))).toBe(0);
    views.update([o], 0.3, STAGE_TINTS[3]);
    const night = glowCircles(fireOf(views, o));
    expect(night).toBeGreaterThanOrEqual(12); // two braziers, a few layers each
    // The glow is added to what is behind it.
    expect(fireOf(views, o).children[0].blendMode).toBe('add');
    // Back to day: gone again.
    views.update([o], 0.6, STAGE_TINTS[0]);
    expect(glowCircles(fireOf(views, o))).toBe(0);
  });

  it('has no fire on the other temples', () => {
    for (let variant = 0; variant < TEMPLE_VARIANTS - 1; variant++) {
      const o = temple(variant);
      const views = new ObstacleViews();
      views.update([o], 0, STAGE_TINTS[3]);
      expect(fireOf(views, o)).toBeUndefined();
      for (const child of views.views.get(o).view.children) expect(child.tint).toBe(STAGE_TINTS[3]);
    }
  });
});
