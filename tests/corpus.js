import { createObstacle } from '../src/sim/generator.js';

// Generated obstacles shared by the tests of one file (M9b.1). createObstacle is
// deterministic per seed and gap, so each is made once and frozen, all the way down:
// no test can change what another sees. generator.test.js keeps its own uncached
// checks that the same seed and gap make the same obstacle.
const made = new Map();

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

export function obstacleAt(seed, gap) {
  const key = `${seed}:${gap}`;
  if (!made.has(key)) made.set(key, deepFreeze(createObstacle(seed, gap)));
  return made.get(key);
}
