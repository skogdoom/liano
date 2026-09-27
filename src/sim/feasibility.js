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
  STAGES,
  BOOST_PERIOD,
} from '../config.js';
import { Liana } from './liana.js';
import { Monkey, slipSteps } from './monkey.js';
import { Obstacle, STATIC_TYPES } from './obstacle.js';
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
export const solverStats = { queries: 0, runs: 0, movingRuns: 0 };
// Whole steps a window of `ms` needs.
export function windowSteps(ms) {
  return Math.ceil(ms / (SIM_DT * 1000) - 1e-9);
}
export const MIN_WINDOW_STEPS = windowSteps(MIN_RELEASE_WINDOW_MS);
// The obstacle scales the stages use (the window table has a section per scale).
export const STAGE_SCALES = [...new Set(STAGES.map((s) => s.scale))];

// The swing variants: normal, and boosted by a banana. A gap within BOOST_GRABS gaps
// after a banana must pass both (the player may or may not have taken it).
export const PERIODS = { normal: SWING_PERIOD, boosted: BOOST_PERIOD };
const variantsFor = (boosted) => (boosted ? [SWING_PERIOD, BOOST_PERIOD] : [SWING_PERIOD]);

// Steps from grabbing at `entryRadius` (or starting the slip `phaseSteps` into the
// swing) until the forced release at the tip, swinging with `period`.
export function forcedReleaseStep(entryRadius, dir = 1, phaseSteps = 0, period = SWING_PERIOD) {
  return slipSteps(Math.min(entryRadius, MAX_ENTRY_RADIUS), phaseSteps, dir, period);
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
// The swing has `period` (SWING_PERIOD, or BOOST_PERIOD when boosted).
export function validReleaseSteps(obstacle, entryRadius, lianaX = 0, dir = 1, phaseSteps = 0, period = SWING_PERIOD) {
  const liana = new Liana(0, lianaX);
  const target = { x: lianaX + dir * LIANA_SPACING, anchorY: liana.anchorY, tipY: liana.tipY };
  const monkey = new Monkey();
  monkey.vx = dir;
  monkey.boostGrabs = period === SWING_PERIOD ? 0 : 1;
  monkey.grab(liana, entryRadius);
  if (phaseSteps > 0) {
    for (let i = 0; i < phaseSteps; i++) liana.step(SIM_DT);
    monkey.startSlipping();
    monkey.step(0);
  }
  solverStats.runs++;

  const lastStep = forcedReleaseStep(entryRadius, dir, phaseSteps, period);
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

// The body's flight from the step after `body` until it grabs `target` (inclusive),
// over an empty gap; null if it does not reach it. Same rules as simulateFlight.
function flightPath(body, target) {
  const b = { x: body.x, y: body.y, vx: body.vx, vy: body.vy };
  const path = [];
  for (let i = 0; i < MAX_FLIGHT_STEPS; i++) {
    ballisticStep(b, SIM_DT, GRAVITY);
    path.push({ x: b.x, y: b.y });
    if (circleIntersectsSegment(b.x, b.y, MONKEY_RADIUS, target.x, target.anchorY, target.x, target.tipY)) return path;
    if (b.y > WORLD_HEIGHT + MONKEY_RADIUS) return null;
  }
  return null;
}

// Moving obstacles. Their whole path keeps clear of the swings, so a hanging monkey is
// never hit; only flights can be. Whether a flight is hit depends on when it happens,
// so the solver samples ARRIVAL_PHASES obstacle times at the grab of the left liana.
// A release that reaches the next liana over an empty gap is valid with the obstacle
// when no point of its flight touches the obstacle at that point's time. The flights
// over an empty gap do not depend on the obstacle and are cached.
export const ARRIVAL_PHASES = 12;

const flightCache = new Map();

// For grabbing liana 0 at `entryRadius` moving forward, swinging with `period`: the
// forced-release step and every release step k that reaches liana 1 over an empty gap,
// with its flight.
export function emptyGapFlights(entryRadius, period = SWING_PERIOD) {
  const key = `${entryRadius}:${period}`;
  let result = flightCache.get(key);
  if (result) return result;
  const liana = new Liana(0, 0);
  const target = { x: LIANA_SPACING, anchorY: liana.anchorY, tipY: liana.tipY };
  const monkey = new Monkey();
  monkey.vx = 1;
  monkey.boostGrabs = period === SWING_PERIOD ? 0 : 1;
  monkey.grab(liana, entryRadius);
  const lastStep = forcedReleaseStep(entryRadius, 1, 0, period);
  const flights = [];
  for (let k = 0; k <= lastStep; k++) {
    if (k > 0) {
      liana.step(SIM_DT);
      monkey.step(SIM_DT);
    }
    if (monkey.vx <= 0) continue;
    const path = flightPath(monkey, target);
    if (path) flights.push({ k, path });
  }
  result = { lastStep, flights };
  flightCache.set(key, result);
  return result;
}

// Whether the flight released at step k after a grab at world time `arrival` touches
// the obstacle. Flight point j comes k + 1 + j steps after the grab.
export function flightHits(obstacle, flight, arrival, box = obstacle.bounds) {
  const reach = MONKEY_RADIUS;
  for (let j = 0; j < flight.path.length; j++) {
    const p = flight.path[j];
    if (p.x < box.minX - reach || p.x > box.maxX + reach || p.y < box.minY - reach || p.y > box.maxY + reach) continue;
    if (obstacle.hitsCircleAt(arrival + (flight.k + 1 + j) * SIM_DT, p.x, p.y, MONKEY_RADIUS)) return true;
  }
  return false;
}

// For a moving obstacle in gap 0, grabbing liana 0 at `entryRadius` at world time
// `arrival` and swinging with `period`: whether each release step up to the forced
// release reaches liana 1.
export function movingValidSteps(obstacle, entryRadius, arrival, period = SWING_PERIOD) {
  const { lastStep, flights } = emptyGapFlights(entryRadius, period);
  const box = obstacle.bounds;
  const valid = new Array(lastStep + 1).fill(false);
  for (const flight of flights) valid[flight.k] = !flightHits(obstacle, flight, arrival, box);
  return valid;
}

// The longest run of valid release steps for that arrival, but stops looking once a
// run reaches `enough` steps.
function movingRun(obstacle, entryRadius, arrival, enough, period) {
  const { flights } = emptyGapFlights(entryRadius, period);
  const box = obstacle.bounds;
  let best = 0;
  let run = 0;
  let previous = -2;
  for (const flight of flights) {
    if (flight.k !== previous + 1) run = 0;
    previous = flight.k;
    if (flightHits(obstacle, flight, arrival, box)) {
      run = 0;
      continue;
    }
    run++;
    best = Math.max(best, run);
    if (best >= enough) break;
  }
  return best;
}

// The arrival times the solver samples: ARRIVAL_PHASES evenly over the period.
export function arrivalTimes(obstacle) {
  return Array.from({ length: ARRIVAL_PHASES }, (_, i) => (i / ARRIVAL_PHASES) * obstacle.motion.period);
}

// The shortest, over every entry radius and sampled arrival, of the longest release
// window (in steps), counting at most `enough` steps, swinging with `period`.
// `obstacle` is in gap 0.
export function movingWindow(obstacle, enough = Infinity, period = SWING_PERIOD) {
  let shortest = Infinity;
  for (const radius of ENTRY_RADII) {
    for (const arrival of arrivalTimes(obstacle)) {
      shortest = Math.min(shortest, movingRun(obstacle, radius, arrival, enough, period));
      if (shortest < enough && enough !== Infinity) return shortest;
    }
  }
  return shortest;
}

// True if every point of the obstacle's path is clear of the lianas either side of the
// gap starting at `leftLianaX` (see isClearOfLianas).
export function isPathClearOfLianas(obstacle, leftLianaX) {
  return obstacle
    .pathPoints()
    .every((p) => isClearOfLianas(new Obstacle(0, obstacle.type, p.x, p.y, null, obstacle.scale), leftLianaX));
}

// A moving obstacle may be generated: its path is clear of the lianas and every entry
// radius and sampled arrival leaves a window of at least `minSteps` (the stage's), in
// the boosted swing too if `boosted`. `obstacle` is in gap 0.
export function isMovingFeasible(obstacle, minSteps = MIN_WINDOW_STEPS, boosted = false) {
  solverStats.movingRuns++;
  return (
    isPathClearOfLianas(obstacle, 0) &&
    variantsFor(boosted).every((period) => movingWindow(obstacle, minSteps, period) >= minSteps)
  );
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
// and `scale` (null type: empty gap), swinging with `period`; `length` is the shortest
// of them, the one that counts. Memoized: a static gap is fully described by
// (type, y, scale) and the swing by its period.
export function releaseWindow(type, y, scale = 1, period = SWING_PERIOD) {
  solverStats.queries++;
  const key = `${type}:${y}:${scale}:${period}`;
  let result = windows.get(key);
  if (!result) {
    const obstacle = type ? new Obstacle(0, type, LIANA_SPACING / 2, y, null, scale) : null;
    const byRadius = ENTRY_RADII.map((r) => ({
      radius: r,
      ...longestRun(validReleaseSteps(obstacle, r, 0, 1, 0, period).valid),
    }));
    result = { byRadius, length: Math.min(...byRadius.map((w) => w.length)) };
    windows.set(key, result);
  }
  return result;
}

// An obstacle of `type` at height `y` and `scale` may be generated: clear of the
// lianas and passable with a window of at least `minSteps` (the stage's), in the
// boosted swing too if `boosted`.
export function isFeasible(type, y, scale = 1, minSteps = MIN_WINDOW_STEPS, boosted = false) {
  solverStats.queries++;
  return (
    isClearOfLianas(new Obstacle(0, type, LIANA_SPACING / 2, y, null, scale), 0) &&
    variantsFor(boosted).every((period) => releaseWindow(type, y, scale, period).length >= minSteps)
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
    STAGE_SCALES,
    BOOST_PERIOD,
  };
}

// Window length in steps for each swing variant (normal, boosted), stage scale, static
// type and whole-pixel height in OBSTACLE_Y_RANGE, 0 where the obstacle would not be
// clear of the lianas. Built by scripts/build-windows.mjs into windowTable.json. The
// stage's minimum window is applied when looking it up.
export function computeWindowTable() {
  const [minY, maxY] = OBSTACLE_Y_RANGE;
  const windows = {};
  for (const [variant, period] of Object.entries(PERIODS)) {
    windows[variant] = {};
    for (const scale of STAGE_SCALES) {
      windows[variant][scale] = {};
      for (const type of STATIC_TYPES) {
        const row = (windows[variant][scale][type] = []);
        for (let y = minY; y <= maxY; y++) {
          const clear = isClearOfLianas(new Obstacle(0, type, LIANA_SPACING / 2, y, null, scale), 0);
          row.push(clear ? releaseWindow(type, y, scale, period).length : 0);
        }
      }
    }
  }
  return { inputs: windowInputs(), minY, maxY, windows };
}
