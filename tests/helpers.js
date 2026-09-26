import { expect } from 'vitest';
import { longestRun, validReleaseSteps, movingValidSteps } from '../src/sim/feasibility.js';
import { SIM_DT, SWING_PERIOD } from '../src/config.js';
import { World } from '../src/sim/world.js';
import { Obstacle } from '../src/sim/obstacle.js';
import { LIANA_SPACING } from '../src/config.js';

export const PERIOD_STEPS = Math.round(SWING_PERIOD / SIM_DT);
// Release steps (sim steps after grabbing) inside the forward and backward windows
// from the start grip, slipping or not. Forward continues in the direction of arrival;
// backward reverses it. Later grabs use windowForGrab: the window depends on the entry.
export const FORWARD_RELEASE_STEP = 29;
export const BACKWARD_RELEASE_STEP = FORWARD_RELEASE_STEP + PERIOD_STEPS / 2;
// Release step at which the monkey misses the next liana and falls.
export const FALL_RELEASE_STEP = 60;

// A world with no obstacles, for testing swing, grab and generation mechanics.
export function emptyWorld() {
  return new World({ makeObstacle: () => null });
}

// A rock low in every gap from 1 on: out of the way of the forward/backward swings used in
// tests, but crossed (and scored) on every hop.
export function lowRockWorld() {
  return new World({
    makeObstacle: (seed, gap) => (gap >= 1 ? new Obstacle(gap, 'rock', (gap + 0.5) * LIANA_SPACING, 620) : null),
  });
}

// A world whose only obstacle is `obstacle(gap)` for the given gaps.
export function worldWith(obstacles) {
  return new World({ makeObstacle: (seed, gap) => obstacles[gap] ?? null });
}

export function stepN(world, n) {
  for (let i = 0; i < n; i++) world.step(SIM_DT);
}

// Steps until a grab event (returns the liana index), or null if the monkey dies first.
export function flyUntilGrab(world, maxSteps = 600) {
  for (let i = 0; i < maxSteps; i++) {
    world.step(SIM_DT);
    const grab = world.takeEvents().find((e) => e.type === 'grab');
    if (grab) return grab.liana;
    if (!world.alive) return null;
  }
  return null;
}

export function releaseAfter(world, steps) {
  stepN(world, steps);
  expect(world.release()).toBe(true);
  world.takeEvents();
}

// Releases the monkey, then places it in the given airborne state. Liana 0 stays excluded.
export function throwMonkey(world, { x, y, vx, vy }) {
  world.release();
  world.takeEvents();
  Object.assign(world.monkey, { x, y, vx, vy });
}

// The longest release window (steps since the grab) for where the monkey of `player`
// hangs now, having just grabbed: solved for its actual entry radius and liana.
export function windowForGrab(world, player = 0) {
  const monkey = world.monkeys[player];
  const { liana } = monkey;
  const dir = liana.swingDir;
  const gap = dir > 0 ? liana.index : liana.index - 1;
  const obstacle = world.obstacles.get(gap) ?? null;
  // Moving obstacles: forward only, solved in gap 0 for the obstacle time at the grab.
  if (obstacle?.moving && dir > 0) {
    return longestRun(movingValidSteps(obstacle.inGap(0), monkey.gripFrom, world.time));
  }
  return longestRun(validReleaseSteps(obstacle, monkey.gripFrom, liana.x, dir).valid);
}

// A release step in the middle of windowForGrab.
export function releaseStepForGrab(world, player = 0) {
  const w = windowForGrab(world, player);
  return w.start + Math.floor(w.length / 2);
}
