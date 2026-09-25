import { describe, it, expect } from 'vitest';
import { MonkeyState } from '../src/sim/monkey.js';
import { lianaIndexRange } from '../src/sim/generator.js';
import { LIANA_SPACING, SCREEN_WIDTH, WORLD_HEIGHT, MONKEY_RADIUS, WORLD_MARGIN, SIM_DT } from '../src/config.js';
import {
  FORWARD_RELEASE_STEP,
  BACKWARD_RELEASE_STEP,
  FALL_RELEASE_STEP,
  emptyWorld,
  stepN,
  flyUntilGrab,
  releaseAfter,
  throwMonkey,
} from './helpers.js';

// Lianas in the generation range, one extra on each side for hysteresis, plus the held one.
const MAX_LIANAS = Math.floor((SCREEN_WIDTH + 2 * WORLD_MARGIN) / LIANA_SPACING) + 1 + 2 + 1;

function expectLianasAroundMonkey(world) {
  const { first, last } = lianaIndexRange(world.monkey.x);
  for (let i = first; i <= last; i++) expect(world.lianas.has(i)).toBe(true);
  expect(world.lianas.size).toBeLessThanOrEqual(MAX_LIANAS);
}

// Swings from liana to liana, checking the entity bound on every step.
function chain(world, firstReleaseStep, hops) {
  let releaseStep = firstReleaseStep;
  let maxSize = 0;
  const visited = [];
  for (let hop = 0; hop < hops; hop++) {
    for (let i = 0; i < releaseStep; i++) {
      world.step(SIM_DT);
      maxSize = Math.max(maxSize, world.lianas.size);
    }
    world.release();
    world.takeEvents();
    const grabbed = flyUntilGrab(world);
    expect(grabbed).not.toBeNull();
    visited.push(grabbed);
    maxSize = Math.max(maxSize, world.lianas.size);
    expectLianasAroundMonkey(world);
    // After the first hop, keep going in the new direction.
    releaseStep = FORWARD_RELEASE_STEP;
  }
  return { visited, maxSize };
}

describe('endless lianas', () => {
  it('generates lianas around the start', () => {
    expectLianasAroundMonkey(emptyWorld());
  });

  it('keeps generating forward with a bounded entity count', () => {
    const world = emptyWorld();
    const { visited, maxSize } = chain(world, FORWARD_RELEASE_STEP, 120);
    expect(visited).toEqual(Array.from({ length: 120 }, (_, k) => k + 1));
    expect(maxSize).toBeLessThanOrEqual(MAX_LIANAS);
    for (const i of world.lianas.keys()) expect(i).toBeGreaterThan(100);
  });

  it('keeps generating backward with a bounded entity count', () => {
    const world = emptyWorld();
    const { visited, maxSize } = chain(world, BACKWARD_RELEASE_STEP, 60);
    expect(visited).toEqual(Array.from({ length: 60 }, (_, k) => -(k + 1)));
    expect(maxSize).toBeLessThanOrEqual(MAX_LIANAS);
    for (const i of world.lianas.keys()) expect(i).toBeLessThan(-40);
  });

  it('keeps the exclusion when the released liana is culled and regenerated', () => {
    const world = emptyWorld();
    throwMonkey(world, { x: 5, y: 200, vx: 0, vy: 0 });
    const original = world.lianas.get(0);
    world.lianas.delete(0);
    world.step(SIM_DT);
    expect(world.lianas.get(0)).not.toBe(original);
    stepN(world, 20);
    expect(world.monkey.state).toBe(MonkeyState.AIRBORNE);
  });
});

describe('fall', () => {
  it('ends the run when the monkey falls below the screen', () => {
    const world = emptyWorld();
    releaseAfter(world, FALL_RELEASE_STEP);
    expect(flyUntilGrab(world)).toBeNull();
    expect(world.alive).toBe(false);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
    expect(world.monkey.y).toBeGreaterThan(WORLD_HEIGHT + MONKEY_RADIUS);
  });

  it('dies exactly when the centre passes WORLD_HEIGHT + MONKEY_RADIUS', () => {
    const world = emptyWorld();
    throwMonkey(world, { x: LIANA_SPACING / 2, y: WORLD_HEIGHT + MONKEY_RADIUS - 1, vx: 0, vy: 0 });
    world.step(SIM_DT);
    expect(world.alive).toBe(true);
    world.monkey.vy = 200;
    world.step(SIM_DT);
    expect(world.alive).toBe(false);
    expect(world.takeEvents()).toEqual([{ type: 'death', cause: 'fall' }]);
    stepN(world, 50);
    expect(world.takeEvents()).toEqual([]);
  });

  it('keeps the velocity on a fall death (no bounce)', () => {
    const world = emptyWorld();
    throwMonkey(world, { x: LIANA_SPACING / 2, y: WORLD_HEIGHT + MONKEY_RADIUS - 1, vx: 120, vy: 200 });
    world.step(SIM_DT);
    expect(world.alive).toBe(false);
    expect(world.monkey.vx).toBe(120);
    expect(world.monkey.vy).toBeGreaterThan(200);
  });

  it('does not end the run when the monkey goes above the top', () => {
    const world = emptyWorld();
    throwMonkey(world, { x: LIANA_SPACING / 2, y: -300, vx: 0, vy: -800 });
    stepN(world, 30);
    expect(world.monkey.y).toBeLessThan(-400);
    expect(world.alive).toBe(true);
  });

  it('ignores release and grabs once dead', () => {
    const world = emptyWorld();
    releaseAfter(world, FALL_RELEASE_STEP);
    flyUntilGrab(world);
    expect(world.release()).toBe(false);
    Object.assign(world.monkey, { x: LIANA_SPACING - 5, y: 200, vx: 0, vy: 0 });
    stepN(world, 5);
    expect(world.monkey.state).toBe(MonkeyState.DEAD);
    expect(world.takeEvents()).toEqual([]);
  });
});
