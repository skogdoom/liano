import { LIANA_SPACING, SCREEN_WIDTH, CAMERA_TARGET_X, WORLD_MARGIN, OBSTACLE_Y_RANGE } from '../config.js';
import { Liana } from './liana.js';
import { Obstacle, OBSTACLE_TYPES } from './obstacle.js';
import { mixSeed, mulberry32 } from './rng.js';
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

// Lowest-risk passable height for `type`: the first feasible one scanning up from the
// bottom of the range.
export function fallbackHeight(type) {
  if (!fallbackHeights.has(type)) {
    const [minY, maxY] = OBSTACLE_Y_RANGE;
    let found = null;
    for (let y = maxY; y >= minY && found === null; y--) if (isPassable(type, y)) found = y;
    if (found === null) throw new Error(`No passable height for ${type} in OBSTACLE_Y_RANGE`);
    fallbackHeights.set(type, found);
  }
  return fallbackHeights.get(type);
}

// Random whole-pixel height with a release window of at least MIN_RELEASE_WINDOW_MS,
// rerolled up to HEIGHT_TRIES times before falling back to a known-passable height.
export function pickHeight(type, rand) {
  const [minY, maxY] = OBSTACLE_Y_RANGE;
  for (let i = 0; i < HEIGHT_TRIES; i++) {
    const y = Math.round(minY + rand() * (maxY - minY));
    if (isPassable(type, y)) return y;
  }
  return fallbackHeight(type);
}

// Obstacle for gap i (between lianas i and i + 1), or null. Deterministic in (seed, gap),
// so a culled gap regenerates identically.
export function createObstacle(seed, gap) {
  if (EMPTY_GAPS.has(gap)) return null;
  const rand = mulberry32(mixSeed(seed, gap));
  const type = OBSTACLE_TYPES[Math.floor(rand() * OBSTACLE_TYPES.length)];
  return new Obstacle(gap, type, (gap + 0.5) * LIANA_SPACING, pickHeight(type, rand));
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
