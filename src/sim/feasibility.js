import {
  SIM_DT,
  GRAVITY,
  ANCHOR_Y,
  GRIP_RADIUS,
  GRIP_SLIDE_TIME,
  LIANA_LENGTH,
  LIANA_SPACING,
  LIANA_CLEARANCE,
  MONKEY_RADIUS,
  SCREEN_HEIGHT,
  SWING_AMPLITUDE,
  SWING_PERIOD,
  MIN_RELEASE_WINDOW_MS,
} from '../config.js';
import { Liana } from './liana.js';
import { Monkey } from './monkey.js';
import { Obstacle } from './obstacle.js';
import { ballisticStep, circleIntersectsSegment } from './physics.js';

// Release-window solver. A gap is passable going forward when its obstacle stays
// clear of both lianas' swept areas and, after grabbing liana i moving forward,
// there is a long enough run of release steps that miss the obstacle and grab
// liana i + 1.
//
// Releases are only possible at sim steps, so windows are counted in steps since
// the grab. Forward releases happen in the first quarter period, while the swing
// still moves forward; later the monkey swings back towards the previous gap.
export const RELEASE_STEPS = Math.round(SWING_PERIOD / SIM_DT / 4);
export const MIN_WINDOW_STEPS = Math.ceil(MIN_RELEASE_WINDOW_MS / (SIM_DT * 1000) - 1e-9);

// The first steps after a grab depend on where the liana was caught (grip slide);
// every window must hold for any point along the liana. After the slide the swing
// is the same whatever the contact point was.
export const ARRIVAL_CONTACT_RADII = [];
for (let c = 0; c <= LIANA_LENGTH; c += 10) ARRIVAL_CONTACT_RADII.push(c);
const SLIDE_STEPS = Math.ceil(GRIP_SLIDE_TIME / SIM_DT);

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
    if (b.y > SCREEN_HEIGHT + MONKEY_RADIUS) return 'fall';
  }
  return 'timeout';
}

// For each release step k in [0, lastStep] after grabbing the liana at `lianaX` at
// `contactRadius` while moving in `dir`: whether releasing then reaches the next
// liana in that direction. Also returns the hanging position at each step and
// whether the monkey was still alive at `lastStep`.
export function validReleaseSteps(obstacle, contactRadius, lianaX = 0, dir = 1, lastStep = RELEASE_STEPS) {
  const liana = new Liana(0, lianaX);
  const target = { x: lianaX + dir * LIANA_SPACING, anchorY: liana.anchorY, tipY: liana.tipY };
  const monkey = new Monkey();
  monkey.vx = dir;
  monkey.grab(liana, contactRadius);

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
    valid.push(alive && simulateFlight(monkey, obstacle, target) === 'grab');
  }
  return { valid, positions, alive };
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
    const valid = validReleaseSteps(obstacle, GRIP_RADIUS).valid;
    for (const c of ARRIVAL_CONTACT_RADII) {
      const slide = validReleaseSteps(obstacle, c, 0, 1, SLIDE_STEPS);
      for (let k = 0; k <= SLIDE_STEPS; k++) valid[k] &&= slide.valid[k];
      if (!slide.alive) valid.fill(false, SLIDE_STEPS + 1);
    }
    result = { valid, ...longestRun(valid) };
    windows.set(key, result);
  }
  return result;
}

// An obstacle of `type` at height `y` may be generated: clear of the lianas and
// passable with a window of at least MIN_RELEASE_WINDOW_MS.
export function isFeasible(type, y) {
  return (
    isClearOfLianas(new Obstacle(0, type, LIANA_SPACING / 2, y), 0) &&
    releaseWindow(type, y).length >= MIN_WINDOW_STEPS
  );
}
