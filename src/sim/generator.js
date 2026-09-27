import {
  LIANA_SPACING,
  SCREEN_WIDTH,
  CAMERA_TARGET_X,
  WORLD_MARGIN,
  OBSTACLE_Y_RANGE,
  MOVING_PERIOD_RANGE,
  SPIDER_LOW_RANGE,
  SPIDER_TRAVEL_RANGE,
  SNAKE_HIGH_RANGE,
  SNAKE_TRAVEL_RANGE,
  BIRD_Y_RANGE,
  BIRD_BOB,
  BANANA_CHANCE,
  BOOST_GRABS,
  ENTRY_RADII,
  SWING_PERIOD,
} from '../config.js';
import { Banana } from './banana.js';
import { Liana } from './liana.js';
import { Obstacle, ObstacleType, STATIC_TYPES, MOVING_TYPES } from './obstacle.js';
import {
  emptyGapFlights,
  flightHits,
  isClearOfLianas,
  isMovingFeasible,
  isPathClearOfLianas,
  windowSteps,
} from './feasibility.js';
import { mixSeed, mulberry32 } from './rng.js';
import { movingShareFor, stageFor } from './stages.js';
import { isPassable } from './windowTable.js';

// Gaps on both sides of the start liana stay empty: the first forward gap lets the
// player learn the timing, and the title-screen swing passes over the one behind.
const EMPTY_GAPS = new Set([-1, 0]);

// Liana i always sits at x = i · LIANA_SPACING, so a culled liana regenerates identically.
export function createLiana(index) {
  return new Liana(index, index * LIANA_SPACING);
}

const HEIGHT_TRIES = 20;
const fallbackHeights = new Map();

// Bananas. Whether a gap has one depends only on (seed, gap): a gap is a candidate with
// BANANA_CHANCE, and has a banana if it is a candidate and neither of the two gaps
// before it is. So an obstacle can know, without generating them, whether a banana
// may boost the swings over its gap.
const BANANA_SALT = 0xba7a;
const BANANA_FROM = 1;

function bananaCandidate(seed, gap) {
  return gap >= BANANA_FROM && mulberry32(mixSeed(seed ^ BANANA_SALT, gap))() < BANANA_CHANCE;
}

export function hasBanana(seed, gap) {
  return bananaCandidate(seed, gap) && !bananaCandidate(seed, gap - 1) && !bananaCandidate(seed, gap - 2);
}

// Whether the swing over `gap` may be boosted: a banana in one of the BOOST_GRABS gaps
// before it boosts the grabs of the lianas after it.
export function mayBeBoosted(seed, gap) {
  for (let i = 1; i <= BOOST_GRABS; i++) if (hasBanana(seed, gap - i)) return true;
  return false;
}

// What the stage of the obstacle in `gap` asks of it: its scale and the whole steps of
// its shortest release window; and whether it must pass the boosted swing too.
export function rulesFor(gap, boosted = false) {
  const stage = stageFor(gap);
  return { scale: stage.scale, minSteps: windowSteps(stage.minWindowMs), boosted };
}

const STAGE_ONE = rulesFor(1);

// Lowest-risk passable height for `type` under `rules`: the first feasible one
// scanning up from the bottom of the range.
export function fallbackHeight(type, rules = STAGE_ONE) {
  const key = `${type}:${rules.scale}:${rules.minSteps}:${rules.boosted}`;
  if (!fallbackHeights.has(key)) {
    const [minY, maxY] = OBSTACLE_Y_RANGE;
    let found = null;
    for (let y = maxY; y >= minY && found === null; y--) {
      if (isPassable(type, y, rules.scale, rules.minSteps, rules.boosted)) found = y;
    }
    if (found === null) throw new Error(`No passable height for ${type} at scale ${rules.scale} in OBSTACLE_Y_RANGE`);
    fallbackHeights.set(key, found);
  }
  return fallbackHeights.get(key);
}

// Random whole-pixel height with a long enough release window under `rules`, rerolled
// up to HEIGHT_TRIES times before falling back to a known-passable height.
export function pickHeight(type, rand, rules = STAGE_ONE) {
  const [minY, maxY] = OBSTACLE_Y_RANGE;
  for (let i = 0; i < HEIGHT_TRIES; i++) {
    const y = Math.round(minY + rand() * (maxY - minY));
    if (isPassable(type, y, rules.scale, rules.minSteps, rules.boosted)) return y;
  }
  return fallbackHeight(type, rules);
}

const MOVING_TRIES = 20;
// Separate random streams for the moving choice, so a gap that stays static gets the
// same type (and random heights) with or without moving obstacles.
const MOVING_SALT = 0x6d0e;

const lerp = ([a, b], t) => a + (b - a) * t;
const pick = (list, rand) => list[Math.floor(rand() * list.length)];

// Bird patrol bounds (gap-0 x) at height y: the widest range around the gap centre
// where the bird (at `scale`), anywhere in its bob, stays clear of both swings. Null if
// there is no room at all.
export function birdPatrolBounds(y, scale = 1) {
  const clear = (x) => {
    for (let dy = -BIRD_BOB; dy <= BIRD_BOB; dy += 1) {
      if (!isClearOfLianas(new Obstacle(0, ObstacleType.BIRD, x, y + dy, null, scale), 0)) return false;
    }
    return true;
  };
  const centre = LIANA_SPACING / 2;
  if (!clear(centre)) return null;
  let lo = centre;
  let hi = centre;
  while (clear(lo - 1)) lo--;
  while (clear(hi + 1)) hi++;
  return [lo + 1, hi - 1];
}

// A random moving obstacle of `type` and `scale` for gap `gap`, or null if a bird has
// no room at the height drawn.
export function movingCandidate(type, gap, rand, scale = 1) {
  const offset = gap * LIANA_SPACING;
  const motion = { period: lerp(MOVING_PERIOD_RANGE, rand()), phase: rand() * 2 * Math.PI, ax: 0, ay: 0, bob: 0 };
  if (type === ObstacleType.BIRD) {
    const y = Math.round(lerp(BIRD_Y_RANGE, rand()));
    const bounds = birdPatrolBounds(y, scale);
    if (!bounds) return null;
    const [lo, hi] = bounds;
    motion.ax = (hi - lo) / 2;
    motion.bob = BIRD_BOB;
    const bird = new Obstacle(gap, type, offset + (lo + hi) / 2, y, motion, scale);
    // The patrol must never reach into a swing.
    if (!isPathClearOfLianas(bird, offset)) throw new Error(`Bird patrol in gap ${gap} reaches a swing`);
    return bird;
  }
  const travel = lerp(type === ObstacleType.SPIDER ? SPIDER_TRAVEL_RANGE : SNAKE_TRAVEL_RANGE, rand());
  motion.ay = travel / 2;
  // Spiders drop from the canopy down to their lowest point; snakes climb from the
  // floor up to their highest.
  const y =
    type === ObstacleType.SPIDER
      ? lerp(SPIDER_LOW_RANGE, rand()) - motion.ay
      : lerp(SNAKE_HIGH_RANGE, rand()) + motion.ay;
  return new Obstacle(gap, type, offset + LIANA_SPACING / 2, y, motion, scale);
}

// Obstacle for gap i (between lianas i and i + 1), or null. Deterministic in (seed, gap),
// so a culled gap regenerates identically. Its stage sets its scale and shortest
// release window, and a banana shortly before it the boosted swing check. From
// MOVING_FROM a share of the gaps get a moving obstacle, rerolled up to MOVING_TRIES
// times until the solver accepts it, else a static one at its lowest-risk passable
// height.
export function createObstacle(seed, gap) {
  if (EMPTY_GAPS.has(gap)) return null;
  const rules = rulesFor(gap, mayBeBoosted(seed, gap));
  const movingShare = movingShareFor(gap);
  if (movingShare > 0) {
    const rand = mulberry32(mixSeed(seed ^ MOVING_SALT, gap));
    if (rand() < movingShare) {
      for (let i = 0; i < MOVING_TRIES; i++) {
        const o = movingCandidate(pick(MOVING_TYPES, rand), gap, rand, rules.scale);
        if (o && isMovingFeasible(o.inGap(0), rules.minSteps, rules.boosted)) return o;
      }
      const type = pick(STATIC_TYPES, rand);
      return new Obstacle(gap, type, (gap + 0.5) * LIANA_SPACING, fallbackHeight(type, rules), null, rules.scale);
    }
  }
  const rand = mulberry32(mixSeed(seed, gap));
  const type = STATIC_TYPES[Math.floor(rand() * STATIC_TYPES.length)];
  return new Obstacle(gap, type, (gap + 0.5) * LIANA_SPACING, pickHeight(type, rand, rules), null, rules.scale);
}

// The banana for gap `gap` (with `obstacle`, as generated), or null. It lies on a flight
// that clears the obstacle but is not the safest one: a release one or two steps inside
// either end of a release window, rather than its middle. Deterministic in (seed, gap).
export function createBanana(seed, gap, obstacle) {
  if (!obstacle || !hasBanana(seed, gap)) return null;
  const rand = mulberry32(mixSeed(seed ^ BANANA_SALT ^ 0x5eed, gap));
  const inGap = obstacle.inGap(0);
  // Moving obstacles: a flight that clears it for one sampled arrival.
  const arrival = obstacle.moving ? rand() * obstacle.motion.period : 0;
  const radius = pick(ENTRY_RADII, rand);
  const { flights } = emptyGapFlights(radius, SWING_PERIOD);
  // Runs of consecutive release steps whose flights clear the obstacle.
  const runs = [];
  for (const flight of flights) {
    if (flightHits(inGap, flight, arrival)) continue;
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1].k === flight.k - 1) run.push(flight);
    else runs.push([flight]);
  }
  const run = runs.reduce((a, b) => (b.length > a.length ? b : a), []);
  if (run.length === 0) return null;
  const edge = Math.min(1 + Math.floor(rand() * 2), run.length - 1);
  const flight = rand() < 0.5 ? run[edge] : run[run.length - 1 - edge];
  // Somewhere in the middle of the flight, over the gap.
  const p = flight.path[Math.floor(flight.path.length * (0.35 + rand() * 0.3))];
  return new Banana(gap, p.x + gap * LIANA_SPACING, p.y);
}

// Liana indices to keep around a monkey at x. The camera keeps the monkey near
// CAMERA_TARGET_X, so the view spans roughly [x − CAMERA_TARGET_X, x − CAMERA_TARGET_X + SCREEN_WIDTH].
// `extra` widens the range (used for hysteresis when culling).
export function lianaIndexRange(x, extra = 0) {
  const left = x - CAMERA_TARGET_X - WORLD_MARGIN - extra;
  const right = x - CAMERA_TARGET_X + SCREEN_WIDTH + WORLD_MARGIN + extra;
  return { first: Math.ceil(left / LIANA_SPACING), last: Math.floor(right / LIANA_SPACING) };
}

// Gaps whose both lianas are in the liana range.
export function gapIndexRange(x, extra = 0) {
  const { first, last } = lianaIndexRange(x, extra);
  return { first, last: last - 1 };
}

// Fills `map` with create(i) for indices in `range` and drops entries outside
// `bounds`, except those in `keep` (one item or an array).
function sync(map, range, bounds, create, keep = null) {
  const kept = keep === null || keep === undefined ? [] : [].concat(keep);
  for (let i = range.first; i <= range.last; i++) {
    if (!map.has(i)) map.set(i, create(i));
  }
  for (const [i, item] of map) {
    const outside = i < bounds.first || i > bounds.last;
    if (outside && !kept.includes(item)) map.delete(i);
  }
}

// The range around monkeys spread from x = `behind` to x = `ahead`.
function span(indexRange, behind, ahead, extra = 0) {
  return { first: indexRange(behind, extra).first, last: indexRange(ahead, extra).last };
}

// Adds missing lianas around the monkeys (from the rearmost at `behind` to the
// furthest at `ahead`) and removes far-away ones, except `keep` (the held lianas).
export function updateLianas(lianas, ahead, keep, behind = ahead) {
  sync(lianas, span(lianaIndexRange, behind, ahead), span(lianaIndexRange, behind, ahead, LIANA_SPACING), createLiana, keep);
}

// Same for obstacles, keyed by gap. Empty gaps are stored as null.
export function updateObstacles(obstacles, ahead, makeObstacle, behind = ahead) {
  sync(obstacles, span(gapIndexRange, behind, ahead), span(gapIndexRange, behind, ahead, LIANA_SPACING), makeObstacle);
}

// Same for bananas (null for gaps without one).
export const updateBananas = updateObstacles;
