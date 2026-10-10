import { describe, it, expect } from 'vitest';
import { BAT_LOOKS, DECORATIONS, FLOWER_COLORS, NEST_STATES } from '../src/render/obstacleViews.js';
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

  it('holds nothing, an egg or a hatched egg in a nest, in about equal shares', () => {
    const counts = Object.fromEntries(NEST_STATES.map((s) => [s, 0]));
    for (let seed = 1; seed <= 300; seed++) {
      const { state, animate } = DECORATIONS.nest(mulberry32(seed));
      counts[state]++;
      for (const t of [0, 0.7, 3.1, 9.9]) animate(t);
    }
    expect(NEST_STATES).toEqual(['empty', 'egg', 'hatched']);
    for (const state of NEST_STATES) expect(counts[state]).toBeGreaterThan(60);
  });

  it('grows three to five flowers, each in a colour of its own, in all the colours', () => {
    const used = new Set();
    let differing = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const { colors, part } = DECORATIONS.flowers(mulberry32(seed));
      expect(colors.length).toBeGreaterThanOrEqual(3);
      expect(colors.length).toBeLessThanOrEqual(5);
      expect(part.children).toHaveLength(colors.length);
      for (const c of colors) {
        expect(FLOWER_COLORS).toContain(c);
        used.add(c);
      }
      if (new Set(colors).size > 1) differing++;
    }
    expect(used.size).toBe(FLOWER_COLORS.length);
    // Most clusters mix colours.
    expect(differing).toBeGreaterThan(60);
  });

  it('turns some of each decoration left and some right', () => {
    for (const decoration of BRANCH_DECORATIONS) {
      const dirs = new Set();
      for (let seed = 1; seed <= 20; seed++) dirs.add(DECORATIONS[decoration](mulberry32(seed)).part.scale.x);
      expect(dirs).toEqual(new Set([-1, 1]));
    }
  });

  it('gives bats slightly different looks, on the wing and hanging', () => {
    expect(BAT_LOOKS.length).toBeGreaterThan(2);
    expect(new Set(BAT_LOOKS.map((l) => l.fur)).size).toBe(BAT_LOOKS.length);
    // Different but still bats: dark fur, a pointed ear, a wing a bit longer or shorter.
    for (const look of BAT_LOOKS) {
      expect(look.ear).toBeGreaterThan(0.7);
      expect(look.ear).toBeLessThan(1.3);
      expect(look.span).toBeGreaterThan(0.8);
      expect(look.span).toBeLessThan(1.2);
    }
  });
});
