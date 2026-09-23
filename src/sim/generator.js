import { LIANA_SPACING, SCREEN_WIDTH, CAMERA_TARGET_X, WORLD_MARGIN, OBSTACLE_Y_RANGE } from '../config.js';
import { Liana } from './liana.js';
import { Obstacle, OBSTACLE_TYPES } from './obstacle.js';
import { mixSeed, mulberry32 } from './rng.js';

// Gaps on both sides of the start liana stay empty: the first forward gap lets the
// player learn the timing, and the title-screen swing passes over the one behind.
const EMPTY_GAPS = new Set([-1, 0]);

// Liana i always sits at x = i · LIANA_SPACING, so a culled liana regenerates identically.
export function createLiana(index) {
  return new Liana(index, index * LIANA_SPACING);
}

// Obstacle for gap i (between lianas i and i + 1), or null. Deterministic in (seed, gap),
// so a culled gap regenerates identically.
export function createObstacle(seed, gap) {
  if (EMPTY_GAPS.has(gap)) return null;
  const rand = mulberry32(mixSeed(seed, gap));
  const type = OBSTACLE_TYPES[Math.floor(rand() * OBSTACLE_TYPES.length)];
  const [minY, maxY] = OBSTACLE_Y_RANGE;
  const y = minY + rand() * (maxY - minY);
  return new Obstacle(gap, type, (gap + 0.5) * LIANA_SPACING, y);
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
// `bounds`, except `keep` when given.
function sync(map, range, bounds, create, keep = null) {
  for (let i = range.first; i <= range.last; i++) {
    if (!map.has(i)) map.set(i, create(i));
  }
  for (const [i, item] of map) {
    const outside = i < bounds.first || i > bounds.last;
    if (outside && (keep === null || item !== keep)) map.delete(i);
  }
}

// Adds missing lianas around x and removes far-away ones, except `keep` (the held liana).
export function updateLianas(lianas, x, keep) {
  sync(lianas, lianaIndexRange(x), lianaIndexRange(x, LIANA_SPACING), createLiana, keep);
}

// Same for obstacles, keyed by gap. Empty gaps are stored as null.
export function updateObstacles(obstacles, x, makeObstacle) {
  sync(obstacles, gapIndexRange(x), gapIndexRange(x, LIANA_SPACING), makeObstacle);
}
