import { STAGES, MOVING_FROM } from '../config.js';

// The stage (1-based number and its row of STAGES) for the obstacle in `gap`.
export function stageFor(gap) {
  let index = 0;
  while (index + 1 < STAGES.length && gap >= STAGES[index + 1].first) index++;
  return { number: index + 1, ...STAGES[index] };
}

// The share of moving obstacles for the obstacle in `gap`: none before MOVING_FROM,
// then the stage's share.
export function movingShareFor(gap) {
  return gap >= MOVING_FROM ? stageFor(gap).movingShare : 0;
}
