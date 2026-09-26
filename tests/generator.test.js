import { describe, it, expect } from 'vitest';
import {
  createLiana,
  createObstacle,
  birdPatrolBounds,
  gapIndexRange,
  lianaIndexRange,
  updateLianas,
  updateObstacles,
} from '../src/sim/generator.js';
import { mulberry32, mixSeed } from '../src/sim/rng.js';
import { Obstacle, ObstacleType, STATIC_TYPES, MOVING_TYPES } from '../src/sim/obstacle.js';
import { isPathClearOfLianas } from '../src/sim/feasibility.js';
import { World } from '../src/sim/world.js';
import {
  LIANA_SPACING,
  SCREEN_WIDTH,
  CAMERA_TARGET_X,
  WORLD_MARGIN,
  OBSTACLE_Y_RANGE,
  STAGES,
  BIRD_Y_RANGE,
  BIRD_BOB,
} from '../src/config.js';

describe('liana generation', () => {
  it('places liana i at i · LIANA_SPACING', () => {
    expect(createLiana(0).x).toBe(0);
    expect(createLiana(7).x).toBe(7 * LIANA_SPACING);
    expect(createLiana(-3).x).toBe(-3 * LIANA_SPACING);
  });

  it.each([0, 123.4, -5000, 250000])('covers the view plus the margin on both sides (x = %d)', (x) => {
    const { first, last } = lianaIndexRange(x);
    const viewLeft = x - CAMERA_TARGET_X;
    const viewRight = viewLeft + SCREEN_WIDTH;
    expect(first * LIANA_SPACING).toBeGreaterThanOrEqual(viewLeft - WORLD_MARGIN);
    expect((first - 1) * LIANA_SPACING).toBeLessThan(viewLeft - WORLD_MARGIN);
    expect(last * LIANA_SPACING).toBeLessThanOrEqual(viewRight + WORLD_MARGIN);
    expect((last + 1) * LIANA_SPACING).toBeGreaterThan(viewRight + WORLD_MARGIN);
  });

  it('adds lianas that come into range and removes those far out of range', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const initial = lianaIndexRange(0);
    expect([...lianas.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: initial.last - initial.first + 1 }, (_, k) => initial.first + k),
    );

    const far = 50 * SCREEN_WIDTH;
    updateLianas(lianas, far, null);
    const range = lianaIndexRange(far);
    for (const i of lianas.keys()) {
      expect(i).toBeGreaterThanOrEqual(range.first);
      expect(i).toBeLessThanOrEqual(range.last);
    }
    expect(lianas.size).toBe(range.last - range.first + 1);
  });

  it('keeps lianas one spacing past the edge of the range (hysteresis)', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const leftmost = lianaIndexRange(0).first;
    const kept = lianas.get(leftmost);
    // Move right just enough for the leftmost liana to leave the generation range.
    const x = leftmost * LIANA_SPACING + CAMERA_TARGET_X + WORLD_MARGIN + 1;
    expect(lianaIndexRange(x).first).toBe(leftmost + 1);
    updateLianas(lianas, x, null);
    expect(lianas.get(leftmost)).toBe(kept);
    // One more spacing and it goes.
    updateLianas(lianas, x + LIANA_SPACING, null);
    expect(lianas.has(leftmost)).toBe(false);
  });

  it('never removes the liana being held', () => {
    const lianas = new Map();
    updateLianas(lianas, 0, null);
    const held = lianas.get(0);
    updateLianas(lianas, 100 * SCREEN_WIDTH, held);
    expect(lianas.get(0)).toBe(held);
  });
});

describe('rng', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('mixes seed and index into distinct seeds', () => {
    const seeds = new Set();
    for (let i = -500; i < 500; i++) seeds.add(mixSeed(7, i));
    expect(seeds.size).toBe(1000);
    expect(mixSeed(7, 3)).not.toBe(mixSeed(8, 3));
  });
});

describe('obstacle generation', () => {
  const SEED = 12345;

  it('leaves the gaps on both sides of the start liana empty', () => {
    expect(createObstacle(SEED, -1)).toBeNull();
    expect(createObstacle(SEED, 0)).toBeNull();
  });

  it('puts one obstacle, horizontally centred, in every other gap', () => {
    for (let gap = -50; gap < 300; gap++) {
      if (gap === -1 || gap === 0) continue;
      const o = createObstacle(SEED, gap);
      expect(o.gap).toBe(gap);
      // Moving obstacles move around the gap centre (birds within half a pixel of it).
      expect(Math.abs(o.baseX - (gap + 0.5) * LIANA_SPACING)).toBeLessThanOrEqual(0.5);
      if (o.moving) continue;
      expect(o.x).toBe((gap + 0.5) * LIANA_SPACING);
      expect(o.y).toBeGreaterThanOrEqual(OBSTACLE_Y_RANGE[0]);
      expect(o.y).toBeLessThanOrEqual(OBSTACLE_Y_RANGE[1]);
    }
  });

  it('uses all types, roughly evenly', () => {
    const counts = Object.fromEntries([...STATIC_TYPES, ...MOVING_TYPES].map((t) => [t, 0]));
    for (let gap = 1; gap <= 3000; gap++) counts[createObstacle(SEED, gap).type]++;
    for (const t of STATIC_TYPES) expect(counts[t]).toBeGreaterThan(200);
    for (const t of MOVING_TYPES) expect(counts[t]).toBeGreaterThan(550);
  });

  it('adds moving obstacles from obstacle 16, in each stage’s share', () => {
    const share = (from, to) => {
      let moving = 0;
      let total = 0;
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        for (let gap = from; gap <= to; gap++, total++) if (createObstacle(seed, gap).moving) moving++;
      }
      return moving / total;
    };
    expect(share(1, 15)).toBe(0);
    for (const stage of STAGES.slice(1)) {
      const s = share(stage.first, stage.first + 14);
      expect(s).toBeGreaterThan(stage.movingShare - 0.12);
      expect(s).toBeLessThan(stage.movingShare + 0.12);
    }
    // Obstacles behind the start stay static.
    for (let gap = -200; gap < 0; gap++) if (gap !== -1) expect(createObstacle(SEED, gap).moving).toBe(false);
  });

  it('keeps the static obstacles of every stage as they were', () => {
    // Moving choices use their own random stream: a gap that stays static gets the
    // obstacle it would have had without moving obstacles.
    for (let gap = 16; gap < 200; gap++) {
      const o = createObstacle(SEED, gap);
      if (o.moving) continue;
      const rand = mulberry32(mixSeed(SEED, gap));
      expect(o.type).toBe(STATIC_TYPES[Math.floor(rand() * STATIC_TYPES.length)]);
    }
  });

  it('sets bird patrols to the widest range clear of the swings', () => {
    for (const y of [BIRD_Y_RANGE[0], 360, BIRD_Y_RANGE[1]]) {
      const [lo, hi] = birdPatrolBounds(y);
      expect(lo + hi).toBeCloseTo(LIANA_SPACING, 0);
      const bird = (x) => new Obstacle(0, ObstacleType.BIRD, x, y, { period: 2, phase: 0, ax: 0, ay: 0, bob: BIRD_BOB });
      expect(isPathClearOfLianas(bird(lo), 0) && isPathClearOfLianas(bird(hi), 0)).toBe(true);
      expect(isPathClearOfLianas(bird(lo - 3), 0) || isPathClearOfLianas(bird(hi + 3), 0)).toBe(false);
    }
    // Lower patrols are wider.
    const width = (y) => birdPatrolBounds(y)[1] - birdPatrolBounds(y)[0];
    expect(width(BIRD_Y_RANGE[1])).toBeGreaterThan(width(BIRD_Y_RANGE[0]));
  });

  it('is deterministic per seed and gap, and differs between seeds', () => {
    const same = (a, b) => a.type === b.type && a.y === b.y && JSON.stringify(a.motion) === JSON.stringify(b.motion);
    for (let gap = 1; gap < 80; gap++) expect(same(createObstacle(SEED, gap), createObstacle(SEED, gap))).toBe(true);
    let differing = 0;
    for (let gap = 1; gap < 50; gap++) if (!same(createObstacle(SEED, gap), createObstacle(SEED + 1, gap))) differing++;
    expect(differing).toBeGreaterThan(40);
  });

  it('keeps obstacles in the gap range and culls far ones, empty gaps included', () => {
    const obstacles = new Map();
    const make = (gap) => createObstacle(SEED, gap);
    updateObstacles(obstacles, 0, make);
    expect(obstacles.has(-1)).toBe(true);
    expect(obstacles.get(0)).toBeNull();

    const far = 40 * SCREEN_WIDTH;
    updateObstacles(obstacles, far, make);
    const range = gapIndexRange(far);
    expect([...obstacles.keys()].every((g) => g >= range.first && g <= range.last)).toBe(true);
    expect(obstacles.size).toBe(range.last - range.first + 1);
  });

  it('regenerates the same obstacle in a world after it is culled', () => {
    const world = new World({ seed: SEED });
    const before = world.obstacles.get(3);
    world.obstacles.delete(3);
    world.step(1 / 120);
    const again = world.obstacles.get(3);
    expect(again).not.toBe(before);
    expect({ type: again.type, x: again.x, y: again.y }).toEqual({ type: before.type, x: before.x, y: before.y });
  });
});
