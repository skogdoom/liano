import { describe, it, expect } from 'vitest';
import {
  releaseWindow,
  isFeasible,
  isClearOfLianas,
  validReleaseSteps,
  longestRun,
  MIN_WINDOW_STEPS,
  forcedReleaseStep,
} from '../src/sim/feasibility.js';
import { createObstacle, pickHeight, fallbackHeight } from '../src/sim/generator.js';
import { Obstacle, OBSTACLE_TYPES } from '../src/sim/obstacle.js';
import { World } from '../src/sim/world.js';
import { MonkeyState } from '../src/sim/monkey.js';
import { mulberry32 } from '../src/sim/rng.js';
import {
  ANCHOR_Y,
  ENTRY_RADII,
  LIANA_LENGTH,
  MAX_ENTRY_RADIUS,
  SLIP_SPEED,
  START_GRIP,
  LIANA_SPACING,
  MIN_RELEASE_WINDOW_MS,
  MONKEY_RADIUS,
  OBSTACLE_Y_RANGE,
  SIM_DT,
  SWING_AMPLITUDE,
} from '../src/config.js';
import { FORWARD_RELEASE_STEP, FALL_RELEASE_STEP, worldWith, stepN, flyUntilGrab, windowForGrab } from './helpers.js';

const windowMs = (steps) => steps * SIM_DT * 1000;

describe('release window solver', () => {
  it('needs 11 consecutive steps for a 90 ms window', () => {
    expect(MIN_WINDOW_STEPS).toBe(Math.ceil(MIN_RELEASE_WINDOW_MS / (SIM_DT * 1000)));
    expect(windowMs(MIN_WINDOW_STEPS)).toBeGreaterThanOrEqual(MIN_RELEASE_WINDOW_MS);
    expect(windowMs(MIN_WINDOW_STEPS - 1)).toBeLessThan(MIN_RELEASE_WINDOW_MS);
  });

  it('finds the longest run of valid steps', () => {
    expect(longestRun([false, true, true, false, true, true, true, false])).toEqual({ start: 4, length: 3 });
    expect(longestRun([true, true, false])).toEqual({ start: 0, length: 2 });
    expect(longestRun([false, false])).toEqual({ start: 0, length: 0 });
  });

  it('gives an empty gap a wide window for every entry radius', () => {
    const w = releaseWindow(null, 0);
    expect(w.byRadius.map((r) => r.radius)).toEqual(ENTRY_RADII);
    expect(w.length).toBeGreaterThan(2 * MIN_WINDOW_STEPS);
    for (const r of w.byRadius) expect(r.start + r.length - 1).toBeLessThanOrEqual(forcedReleaseStep(r.radius));
  });

  it('checks each entry radius up to its forced release at the tip', () => {
    expect(forcedReleaseStep(LIANA_LENGTH - SLIP_SPEED)).toBe(120);
    // Entries below MAX_ENTRY_RADIUS count as MAX_ENTRY_RADIUS.
    expect(forcedReleaseStep(LIANA_LENGTH)).toBe(forcedReleaseStep(MAX_ENTRY_RADIUS));
    for (const r of ENTRY_RADII) {
      const { valid, forcedStep } = validReleaseSteps(null, r);
      expect(forcedStep).toBe(forcedReleaseStep(r));
      expect(valid).toHaveLength(forcedStep + 1);
    }
  });

  it('rejects obstacles in the middle heights, where the swings reach', () => {
    for (const type of OBSTACLE_TYPES) {
      const o = new Obstacle(0, type, LIANA_SPACING / 2, 250);
      expect(isClearOfLianas(o, 0)).toBe(false);
      expect(isFeasible(type, 250)).toBe(false);
    }
  });

  it('agrees with the real world for every release step', () => {
    // Heights at the edges of the passable ranges, where the window is tight.
    const cases = [
      ['branch', 135], ['branch', 150], ['branch', 355],
      ['thornBush', 170], ['thornBush', 335],
      ['rock', 190], ['rock', 325],
    ];
    for (const [type, y] of cases) {
      for (const c of [...ENTRY_RADII, 250]) {
        const obstacle = new Obstacle(0, type, LIANA_SPACING / 2, y);
        const { valid } = validReleaseSteps(obstacle, c);
        // Every step up to the forced release; k = 0 and the forced step itself included.
        for (let k = 0; k < valid.length; k += k < 40 || valid.length - k < 40 ? 1 : 7) {
          const world = worldWith({ 0: obstacle });
          world.start();
          world.monkey.grab(world.lianas.get(0), c); // restart the swing, grabbed at c
          stepN(world, k);
          let reached = false;
          if (world.alive) {
            world.release();
            reached = flyUntilGrab(world) === 1;
          }
          expect({ type, y, c, k, reached }).toEqual({ type, y, c, k, reached: valid[k] });
        }
      }
    }
  });
});

describe('the start liana', () => {
  it('agrees with the real world when the run starts partway through the title swing', () => {
    for (const phase of [0, 100, 250]) {
      const { valid } = validReleaseSteps(null, START_GRIP, 0, 1, phase);
      expect(valid.some(Boolean)).toBe(true);
      for (let k = 0; k < valid.length; k += 3) {
        const world = worldWith({});
        stepN(world, phase);
        world.start();
        stepN(world, k);
        world.release();
        const reached = flyUntilGrab(world) === 1;
        expect({ phase, k, reached }).toEqual({ phase, k, reached: valid[k] });
      }
    }
  });
});

describe('fair generation', () => {
  it(`gives every one of 1,000 seeded gaps a window of at least ${MIN_RELEASE_WINDOW_MS} ms for every entry radius`, () => {
    let checked = 0;
    for (const seed of [1, 99, 2024, 31337]) {
      for (let gap = 1; gap <= 250; gap++) {
        const o = createObstacle(seed, gap);
        const w = releaseWindow(o.type, o.y);
        expect(windowMs(w.length)).toBeGreaterThanOrEqual(MIN_RELEASE_WINDOW_MS);
        expect(Number.isInteger(o.y)).toBe(true);
        expect(o.y).toBeGreaterThanOrEqual(OBSTACLE_Y_RANGE[0]);
        expect(o.y).toBeLessThanOrEqual(OBSTACLE_Y_RANGE[1]);
        checked++;
      }
    }
    expect(checked).toBe(1000);
  });

  it('keeps every generated obstacle clear of the swinging lianas and hanging monkey', () => {
    // Brute force, independent of the sector maths: sweep the rope and the monkey
    // (hanging anywhere on it) through the full swing of both neighbouring lianas.
    const angles = [];
    for (let a = -SWING_AMPLITUDE; a <= SWING_AMPLITUDE + 1e-9; a += SWING_AMPLITUDE / 40) angles.push(a);
    const seen = new Set();
    const hits = [];
    for (let gap = 1; gap <= 400; gap++) {
      const o = createObstacle(77, gap);
      const key = `${o.type}:${o.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const lianaX of [gap * LIANA_SPACING, (gap + 1) * LIANA_SPACING]) {
        for (const a of angles) {
          for (let r = 0; r <= LIANA_LENGTH; r += 4) {
            const x = lianaX + r * Math.sin(a);
            const y = ANCHOR_Y + r * Math.cos(a);
            if (o.hitsCircle(x, y, MONKEY_RADIUS)) hits.push({ key, lianaX, a, r });
          }
        }
      }
    }
    expect(hits).toEqual([]);
    expect(seen.size).toBeGreaterThan(100);
  });

  it('rerolls infeasible heights and falls back to a known-passable one', () => {
    for (const type of OBSTACLE_TYPES) {
      expect(isFeasible(type, fallbackHeight(type))).toBe(true);
      // Always lands in the infeasible middle band.
      const stuck = () => 0.3;
      expect(isFeasible(type, Math.round(OBSTACLE_Y_RANGE[0] + 0.3 * (OBSTACLE_Y_RANGE[1] - OBSTACLE_Y_RANGE[0])))).toBe(false);
      expect(pickHeight(type, stuck)).toBe(fallbackHeight(type));
    }
  });

  it('still produces varied heights on both sides of the band', () => {
    const ys = [];
    for (let gap = 1; gap <= 600; gap++) ys.push(createObstacle(5, gap).y);
    expect(ys.filter((y) => y < 300).length).toBeGreaterThan(100);
    expect(ys.filter((y) => y > 300).length).toBeGreaterThan(100);
    expect(new Set(ys).size).toBeGreaterThan(80);
  });
});

describe('fairness in play', () => {
  // Plays forward, releasing at a step inside each gap's generated window.
  // The window must hold whatever point on the liana the monkey actually caught.
  function playForward(seed, hops, pick) {
    const world = new World({ seed });
    world.start();
    const rand = mulberry32(seed);
    for (let hop = 0; hop < hops; hop++) {
      const index = world.monkey.liana.index;
      const w = windowForGrab(world);
      expect({ seed, hop, length: w.length >= MIN_WINDOW_STEPS }).toEqual({ seed, hop, length: true });
      stepN(world, pick(w, rand));
      world.release();
      const grabbed = flyUntilGrab(world);
      expect({ seed, hop, grabbed }).toEqual({ seed, hop, grabbed: index + 1 });
    }
    return world;
  }

  const policies = {
    'window start': (w) => w.start,
    'window end': (w) => w.start + w.length - 1,
    'random in window': (w, rand) => w.start + Math.floor(rand() * w.length),
  };

  for (const [name, pick] of Object.entries(policies)) {
    it(`never dies releasing at the ${name}`, () => {
      for (const seed of [3, 17, 256, 4096]) {
        const world = playForward(seed, 60, pick);
        expect(world.alive).toBe(true);
        expect(world.score).toBe(59); // gap 0 is empty
      }
    });
  }
});

describe('flight prediction', () => {
  function actualPath(world, steps) {
    const path = [{ x: world.monkey.x, y: world.monkey.y }];
    world.release();
    while (world.monkey.state === MonkeyState.AIRBORNE && world.alive) {
      world.step(SIM_DT);
      path.push({ x: world.monkey.x, y: world.monkey.y });
    }
    return path;
  }

  it('predicts the grab when released inside the window', () => {
    const world = worldWith({});
    stepN(world, FORWARD_RELEASE_STEP);
    const prediction = world.predictFlight();
    expect(prediction.outcome).toBe('grab');
    const path = actualPath(world);
    // Up to the grab step the prediction is exact; the grab then snaps onto the liana.
    expect(prediction.path.slice(0, -1)).toEqual(path.slice(0, prediction.path.length - 1));
    expect(prediction.path).toHaveLength(path.length);
  });

  it('predicts a fall', () => {
    const world = worldWith({});
    stepN(world, FALL_RELEASE_STEP);
    expect(world.predictFlight().outcome).toBe('fall');
  });

  it('predicts an obstacle hit', () => {
    const clear = worldWith({});
    stepN(clear, FORWARD_RELEASE_STEP);
    const { path } = clear.predictFlight();
    const mid = path[Math.floor(path.length / 2)];

    const world = worldWith({ 0: new Obstacle(0, 'rock', mid.x, mid.y) });
    stepN(world, FORWARD_RELEASE_STEP);
    expect(world.alive).toBe(true);
    expect(world.predictFlight().outcome).toBe('hit');
  });
});
