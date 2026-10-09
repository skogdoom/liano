import { STAGES, STAGE_LENGTH_AFTER, MOVING_FROM } from '../config.js';

// The stage for the obstacle in `gap`: its 1-based `number` and the difficulty of its
// row of STAGES. After the last row the difficulty stays, and the number keeps counting
// every STAGE_LENGTH_AFTER obstacles (the sky goes on through its day, see background.js).
export function stageFor(gap) {
  let index = 0;
  while (index + 1 < STAGES.length && gap >= STAGES[index + 1].first) index++;
  const last = STAGES.length - 1;
  const beyond = index === last ? Math.floor((gap - STAGES[last].first) / STAGE_LENGTH_AFTER) : 0;
  return { number: index + 1 + beyond, ...STAGES[index] };
}

// The share of moving obstacles for the obstacle in `gap`: none before MOVING_FROM,
// then the stage's share.
export function movingShareFor(gap) {
  return gap >= MOVING_FROM ? stageFor(gap).movingShare : 0;
}
