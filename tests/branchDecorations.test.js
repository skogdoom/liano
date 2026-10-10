import { describe, it, expect } from 'vitest';
import { DECORATIONS } from '../src/render/obstacleViews.js';
import { BRANCH_DECORATIONS } from '../src/sim/obstacle.js';
import { mulberry32 } from '../src/sim/rng.js';

describe('branch decoration art', () => {
  it('has a drawing for every decoration a branch can carry, and for no other', () => {
    expect(Object.keys(DECORATIONS).sort()).toEqual([...BRANCH_DECORATIONS].sort());
  });

  for (const decoration of BRANCH_DECORATIONS) {
    it(`animates the ${decoration} without trouble, in either direction`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const { part, animate } = DECORATIONS[decoration](mulberry32(seed));
        expect(part.children.length).toBeGreaterThan(0);
        expect(Math.abs(part.scale.x)).toBe(1);
        for (const t of [0, 0.4, 1.3, 2.9, 17.2, 1234.5]) animate(t);
      }
    });
  }

  it('turns some of each decoration left and some right', () => {
    for (const decoration of BRANCH_DECORATIONS) {
      const dirs = new Set();
      for (let seed = 1; seed <= 20; seed++) dirs.add(DECORATIONS[decoration](mulberry32(seed)).part.scale.x);
      expect(dirs).toEqual(new Set([-1, 1]));
    }
  });
});
