import { describe, it, expect } from 'vitest';
import { BAT_LOOKS, FLOWER_COLORS, NEST_STATES, coconutBunch, flowerCluster, hangingBat, hangingMonkey, nestPlacement, owlPlacement, pantherPlacement, perchedBird, perchedSnake } from '../src/views/obstacles.js';
import { mulberry32 } from '../src/sim/rng.js';

describe('branch decoration art', () => {
  it('holds nothing, an egg or a hatched egg in a nest, in about equal shares', () => {
    const counts = Object.fromEntries(NEST_STATES.map((s) => [s, 0]));
    for (let seed = 1; seed <= 300; seed++) {
      const { state } = nestPlacement(mulberry32(seed));
      counts[state]++;
    }
    expect(NEST_STATES).toEqual(['empty', 'egg', 'hatched']);
    for (const state of NEST_STATES) expect(counts[state]).toBeGreaterThan(60);
  });

  it('grows three to five flowers, each in a colour of its own, in all the colours', () => {
    const used = new Set();
    let differing = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const { plants } = flowerCluster(mulberry32(seed));
      const colors = plants.map((p) => p.color);
      expect(colors.length).toBeGreaterThanOrEqual(3);
      expect(colors.length).toBeLessThanOrEqual(5);
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
    for (const placement of [perchedBird, perchedSnake, hangingMonkey, nestPlacement, pantherPlacement, hangingBat, owlPlacement, flowerCluster, coconutBunch]) {
      const dirs = new Set();
      for (let seed = 1; seed <= 20; seed++) {
        const data = placement(mulberry32(seed));
        dirs.add(data.dir ?? data.facing);
      }
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
