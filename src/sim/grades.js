import { GRADE_BOUNDS, HIGH_BELOW_Y } from '../config.js';
import { mixSeed, mulberry32 } from './rng.js';
import { stageFor } from './stages.js';

export const GRADES = [1, 2, 3, 4];

// The grade (1 to 4) of an obstacle that blocks `share` of the release steps.
export function gradeOf(share) {
  return 1 + GRADE_BOUNDS.filter((bound) => share >= bound).length;
}

// The highest grade the stage of `gap` lets in: the highest it has odds for.
export function maxGradeFor(gap) {
  const { grades } = stageFor(gap);
  return GRADES.filter((g) => grades[g - 1] > 0).at(-1);
}

const GRADE_SALT = 0x96ad;

// The grade the obstacle of `gap` aims for: drawn from its stage's odds, from a random
// stream of its own. Deterministic in (seed, gap).
export function targetGradeFor(seed, gap) {
  const { grades } = stageFor(gap);
  const total = grades.reduce((a, b) => a + b, 0);
  let x = mulberry32(mixSeed(seed ^ GRADE_SALT, gap))() * total;
  for (const g of GRADES) {
    x -= grades[g - 1];
    if (x < 0 && grades[g - 1] > 0) return g;
  }
  return maxGradeFor(gap);
}

// Whether an obstacle at height `y` is high (hangs from the canopy) rather than low.
export const isHigh = (y) => y < HIGH_BELOW_Y;

const SIDE_SALT = 0x51de;

// Whether the obstacle of `gap` aims to be high (true) or low (false), drawn from its
// stage's `high` share from a random stream of its own; null when the stage has no
// preference. Deterministic in (seed, gap).
export function aimsHigh(seed, gap) {
  const { high } = stageFor(gap);
  return high === null ? null : mulberry32(mixSeed(seed ^ SIDE_SALT, gap))() < high;
}
