import {
  SIM_DT,
  GRAVITY,
  ANCHOR_Y,
  MAX_SLIP_SPEED,
  SLIP_OFF_PHASE,
  MAX_ENTRY_RADIUS,
  ENTRY_RADII,
  LIANA_LENGTH,
  LIANA_SPACING,
  LIANA_CLEARANCE,
  MONKEY_RADIUS,
  WORLD_HEIGHT,
  SWING_AMPLITUDE,
  SWING_PERIOD,
  MIN_RELEASE_WINDOW_MS,
  OBSTACLE_Y_RANGE,
  OBSTACLE_HITBOXES,
} from '../config.js';
import { Liana } from './liana.js';
import { Monkey, slipSteps } from './monkey.js';
import { Obstacle, OBSTACLE_TYPES } from './obstacle.js';
import { ballisticStep, circleIntersectsSegment } from './physics.js';

// Release-window solver. A gap is passable going forward when its obstacle stays
// clear of both lianas' swept areas and, for every entry radius in ENTRY_RADII, after
// grabbing liana i there moving forward, there is a long enough run of release steps
// that miss the obstacle and grab liana i + 1, before the grip slips to the tip and
// forces a release.
//
// Releases are only possible at sim steps, so windows are counted in steps since the
// grab. The grip slips as the monkey swings, so each entry radius gives a different
// swing, and windows can come in any forward swing before the forced release.

// How often the solver was asked (queries, cached or not) and actually ran (runs),
// so tests can check that play only uses the precomputed table.
export const solverStats = { queries: 0, runs: 0 };
export const MIN_WINDOW_STEPS = Math.ceil(MIN_RELEASE_WINDOW_MS / (SIM_DT * 1000) - 1e-9);

// Steps from grabbing at `entryRadius` (or starting the slip `phaseSteps` into the
// swing) until the forced release at the tip.
export function forcedReleaseStep(entryRadius, dir = 1, phaseSteps = 0) {
  return slipSteps(Math.min(entryRadius, MAX_ENTRY_RADIUS), phaseSteps, dir);
}

// True if the obstacle keeps LIANA_CLEARANCE away from everything the lianas on both
// sides of its gap can sweep: the rope over the full swing and the monkey hanging
// anywhere on it. The margin also covers the rope's width and the small overshoot
// of the cosmetic settle sway.
export function isClearOfLianas(obstacle, leftLianaX) {
  const minDistance = MONKEY_RADIUS + LIANA_CLEARANCE;
  return [leftLianaX, leftLianaX + LIANA_SPACING].every(
    (x) => obstacle.distanceToSector(x, ANCHOR_Y, LIANA_LENGTH, SWING_AMPLITUDE) > minDistance,
  );
}

const MAX_FLIGHT_STEPS = 600;

// Flies a released body with the same rules as World.step: an obstacle hit wins over
// grabbing `target` in the same step. Returns 'hit', 'grab', 'fall' or 'timeout'.
export function simulateFlight(body, obstacle, target) {
  const b = { x: body.x, y: body.y, vx: body.vx, vy: body.vy };
  for (let i = 0; i < MAX_FLIGHT_STEPS; i++) {
    ballisticStep(b, SIM_DT, GRAVITY);
    if (obstacle && obstacle.hitsCircle(b.x, b.y, MONKEY_RADIUS)) return 'hit';
    if (circleIntersectsSegment(b.x, b.y, MONKEY_RADIUS, target.x, target.anchorY, target.x, target.tipY)) {
      return 'grab';
    }
    if (b.y > WORLD_HEIGHT + MONKEY_RADIUS) return 'fall';
  }
  return 'timeout';
}

// For each release step k after grabbing the liana at `lianaX` at `entryRadius` while
// moving in `dir`, up to and including the forced release at the tip: whether
// releasing then reaches the next liana in that direction. Also returns the hanging
// position at each step. A release moving away from the target is invalid without
// flying it. `phaseSteps` starts the slip that many steps into the swing (the start
// liana swings on the title screen before the run starts the slip); grabs start at 0.
export function validReleaseSteps(obstacle, entryRadius, lianaX = 0, dir = 1, phaseSteps = 0) {
  const liana = new Liana(0, lianaX);
  const target = { x: lianaX + dir * LIANA_SPACING, anchorY: liana.anchorY, tipY: liana.tipY };
  const monkey = new Monkey();
  monkey.vx = dir;
  monkey.grab(liana, entryRadius);
  if (phaseSteps > 0) {
    for (let i = 0; i < phaseSteps; i++) liana.step(SIM_DT);
    monkey.startSlipping();
    monkey.step(0);
  }
  solverStats.runs++;

  const lastStep = forcedReleaseStep(entryRadius, dir, phaseSteps);
  const valid = [];
  const positions = [];
  let alive = true;
  for (let k = 0; k <= lastStep; k++) {
    if (k > 0 && alive) {
      liana.step(SIM_DT);
      monkey.step(SIM_DT);
      alive = !(obstacle && obstacle.hitsCircle(monkey.x, monkey.y, MONKEY_RADIUS));
    }
    positions.push({ x: monkey.x, y: monkey.y });
    valid.push(alive && monkey.vx * dir > 0 && simulateFlight(monkey, obstacle, target) === 'grab');
  }
  return { valid, positions, alive, forcedStep: lastStep };
}

export function longestRun(valid) {
  let best = { start: 0, length: 0 };
  let start = 0;
  for (let k = 0; k < valid.length; k++) {
    if (!valid[k]) continue;
    if (k === 0 || !valid[k - 1]) start = k;
    if (k - start + 1 > best.length) best = { start, length: k - start + 1 };
  }
  return best;
}

const windows = new Map();

// The longest window for each entry radius, for an obstacle of `type` at height `y`
// (null type: empty gap); `length` is the shortest of them, the one that counts.
// Memoized: a gap is fully described by (type, y).
export function releaseWindow(type, y) {
  solverStats.queries++;
  const key = `${type}:${y}`;
  let result = windows.get(key);
  if (!result) {
    const obstacle = type ? new Obstacle(0, type, LIANA_SPACING / 2, y) : null;
    const byRadius = ENTRY_RADII.map((r) => ({ radius: r, ...longestRun(validReleaseSteps(obstacle, r).valid) }));
    result = { byRadius, length: Math.min(...byRadius.map((w) => w.length)) };
    windows.set(key, result);
  }
  return result;
}

// An obstacle of `type` at height `y` may be generated: clear of the lianas and
// passable with a window of at least MIN_RELEASE_WINDOW_MS.
export function isFeasible(type, y) {
  solverStats.queries++;
  return (
    isClearOfLianas(new Obstacle(0, type, LIANA_SPACING / 2, y), 0) &&
    releaseWindow(type, y).length >= MIN_WINDOW_STEPS
  );
}

// Everything the windows depend on. The precomputed table (windowTable.json) is only
// trusted while these match the values it was built from.
export function windowInputs() {
  return {
    SIM_DT,
    GRAVITY,
    ANCHOR_Y,
    MAX_SLIP_SPEED,
    SLIP_OFF_PHASE,
    MAX_ENTRY_RADIUS,
    LIANA_LENGTH,
    LIANA_SPACING,
    LIANA_CLEARANCE,
    MONKEY_RADIUS,
    WORLD_HEIGHT,
    SWING_AMPLITUDE,
    SWING_PERIOD,
    MIN_RELEASE_WINDOW_MS,
    OBSTACLE_Y_RANGE,
    OBSTACLE_HITBOXES,
    ENTRY_RADII,
  };
}

// Window length in steps for every type and whole-pixel height in OBSTACLE_Y_RANGE,
// 0 where the obstacle would not be clear of the lianas. Built by
// scripts/build-windows.mjs into windowTable.json.
export function computeWindowTable() {
  const [minY, maxY] = OBSTACLE_Y_RANGE;
  const windows = {};
  for (const type of OBSTACLE_TYPES) {
    windows[type] = [];
    for (let y = minY; y <= maxY; y++) {
      const clear = isClearOfLianas(new Obstacle(0, type, LIANA_SPACING / 2, y), 0);
      windows[type].push(clear ? releaseWindow(type, y).length : 0);
    }
  }
  return { inputs: windowInputs(), minY, maxY, windows };
}
