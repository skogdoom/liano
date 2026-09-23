import { LIANA_SPACING, SCREEN_WIDTH, CAMERA_TARGET_X, WORLD_MARGIN } from '../config.js';
import { Liana } from './liana.js';

// Liana i always sits at x = i · LIANA_SPACING, so a culled liana regenerates identically.
export function createLiana(index) {
  return new Liana(index, index * LIANA_SPACING);
}

// Liana indices to keep around a monkey at x. The camera keeps the monkey near
// CAMERA_TARGET_X, so the view spans roughly [x − CAMERA_TARGET_X, x − CAMERA_TARGET_X + SCREEN_WIDTH].
// `extra` widens the range (used for hysteresis when culling).
export function lianaIndexRange(x, extra = 0) {
  const left = x - CAMERA_TARGET_X - WORLD_MARGIN - extra;
  const right = x - CAMERA_TARGET_X + SCREEN_WIDTH + WORLD_MARGIN + extra;
  return { first: Math.ceil(left / LIANA_SPACING), last: Math.floor(right / LIANA_SPACING) };
}

// Adds missing lianas around x and removes far-away ones, except `keep` (the held liana).
export function updateLianas(lianas, x, keep) {
  const { first, last } = lianaIndexRange(x);
  for (let i = first; i <= last; i++) {
    if (!lianas.has(i)) lianas.set(i, createLiana(i));
  }
  const bounds = lianaIndexRange(x, LIANA_SPACING);
  for (const [i, liana] of lianas) {
    if ((i < bounds.first || i > bounds.last) && liana !== keep) lianas.delete(i);
  }
}
