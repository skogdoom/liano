import {
  SIM_DT,
  GRAVITY,
  LIANA_LENGTH,
  LIANA_SPACING,
  MONKEY_RADIUS,
  SCREEN_HEIGHT,
  SWING_PERIOD,
  MIN_RELEASE_WINDOW_MS,
} from '../config.js';
import { Liana } from './liana.js';
import { Monkey } from './monkey.js';
import { Obstacle } from './obstacle.js';
import { ballisticStep, circleIntersectsSegment } from './physics.js';

// Release-window solver. A gap is passable going forward when, after grabbing
// liana i moving forward, there is a long enough run of release steps that
// survive the swing, miss the obstacle and grab liana i + 1.
//
// Releases are only possible at sim steps, so windows are counted in steps since
// the grab. Forward releases happen in the first quarter period, while the swing
// still moves forward; later the monkey swings back towards the previous gap.
export const RELEASE_STEPS = Math.round(SWING_PERIOD / SIM_DT / 4);
export const MIN_WINDOW_STEPS = Math.ceil(MIN_RELEASE_WINDOW_MS / (SIM_DT * 1000) - 1e-9);

// The first steps after a grab depend on where the liana was caught (grip slide).
// Forward landings catch the liana between about 234 px from the anchor and the tip;
// every window must hold for all of them.
export const ARRIVAL_CONTACT_RADII = [];
for (let c = 200; c <= LIANA_LENGTH; c += 10) ARRIVAL_CONTACT_RADII.push(c);

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
    if (b.y > SCREEN_HEIGHT + MONKEY_RADIUS) return 'fall';
  }
  return 'timeout';
}

// For each release step k in [0, RELEASE_STEPS] after grabbing the liana at `lianaX`
// at `contactRadius` while moving in `dir`: whether releasing then reaches the next
// liana in that direction. Also returns the hanging position at each step.
export function validReleaseSteps(obstacle, contactRadius, lianaX = 0, dir = 1) {
  const liana = new Liana(0, lianaX);
  const target = { x: lianaX + dir * LIANA_SPACING, anchorY: liana.anchorY, tipY: liana.tipY };
  const monkey = new Monkey();
  monkey.vx = dir;
  monkey.grab(liana, contactRadius);

  const valid = [];
  const positions = [];
  let alive = true;
  for (let k = 0; k <= RELEASE_STEPS; k++) {
    if (k > 0 && alive) {
      liana.step(SIM_DT);
      monkey.step(SIM_DT);
      alive = !(obstacle && obstacle.hitsCircle(monkey.x, monkey.y, MONKEY_RADIUS));
    }
    positions.push({ x: monkey.x, y: monkey.y });
    valid.push(alive && simulateFlight(monkey, obstacle, target) === 'grab');
  }
  return { valid, positions };
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

// Release steps valid for every arrival radius, for an obstacle of `type` at height
// `y` (null type: empty gap). Memoized: a gap is fully described by (type, y).
export function releaseWindow(type, y) {
  const key = `${type}:${y}`;
  let result = windows.get(key);
  if (!result) {
    const obstacle = type ? new Obstacle(0, type, LIANA_SPACING / 2, y) : null;
    let valid = null;
    for (const c of ARRIVAL_CONTACT_RADII) {
      const v = validReleaseSteps(obstacle, c).valid;
      valid = valid ? valid.map((ok, k) => ok && v[k]) : v;
    }
    result = { valid, ...longestRun(valid) };
    windows.set(key, result);
  }
  return result;
}

export function isFeasible(type, y) {
  return releaseWindow(type, y).length >= MIN_WINDOW_STEPS;
}
