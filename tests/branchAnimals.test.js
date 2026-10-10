import { describe, it, expect } from 'vitest';
import { ANIMALS } from '../src/render/obstacleViews.js';
import { BRANCH_ANIMALS } from '../src/sim/obstacle.js';
import { mulberry32 } from '../src/sim/rng.js';

describe('branch animal art', () => {
  it('has a drawing for every animal a branch can carry, and for no other', () => {
    expect(Object.keys(ANIMALS).sort()).toEqual([...BRANCH_ANIMALS].sort());
  });

  for (const animal of BRANCH_ANIMALS) {
    it(`animates the ${animal} without trouble, in either direction`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const { part, animate } = ANIMALS[animal](mulberry32(seed));
        expect(part.children.length).toBeGreaterThan(0);
        expect(Math.abs(part.scale.x)).toBe(1);
        for (const t of [0, 0.4, 1.3, 2.9, 17.2, 1234.5]) animate(t);
      }
    });
  }

  it('turns some of each animal left and some right', () => {
    for (const animal of BRANCH_ANIMALS) {
      const dirs = new Set();
      for (let seed = 1; seed <= 20; seed++) dirs.add(ANIMALS[animal](mulberry32(seed)).part.scale.x);
      expect(dirs).toEqual(new Set([-1, 1]));
    }
  });
});
