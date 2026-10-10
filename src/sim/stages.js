import {
  STAGES,
  STAGE_LENGTH_AFTER,
  LATER_WINDOW_STEP_MS,
  LATER_MIN_WINDOW_MS,
  LATER_MOVING_STEP,
  LATER_MOVING_MAX,
  MOVING_FROM,
} from '../config.js';

// The stage for the obstacle in `gap`: its 1-based `number` and its difficulty (a row of
// STAGES). After the last row the number keeps counting every STAGE_LENGTH_AFTER
// obstacles (the sky goes on through its day, see background.js), and each such stage
// asks a little more than the one before: a shorter shortest window and a larger moving
// share, each down or up to a limit; the obstacle scale stays.
export function stageFor(gap) {
  let index = 0;
  while (index + 1 < STAGES.length && gap >= STAGES[index + 1].first) index++;
  const last = STAGES.length - 1;
  const beyond = index === last ? Math.floor((gap - STAGES[last].first) / STAGE_LENGTH_AFTER) : 0;
  const row = STAGES[index];
  return {
    number: index + 1 + beyond,
    ...row,
    minWindowMs: Math.max(row.minWindowMs - beyond * LATER_WINDOW_STEP_MS, Math.min(LATER_MIN_WINDOW_MS, row.minWindowMs)),
    movingShare: Math.min(row.movingShare + beyond * LATER_MOVING_STEP, Math.max(LATER_MOVING_MAX, row.movingShare)),
  };
}

// The times of day the stages go through (see stageFor: the stage number counts on past
// the last row of STAGES, and the sky starts its day over after dawn).
export const TimeOfDay = Object.freeze({ DAY: 0, LATE_AFTERNOON: 1, DUSK: 2, NIGHT: 3, DAWN: 4 });
const TIMES_OF_DAY = Object.keys(TimeOfDay).length;

// The time of day for the obstacle in `gap` (a TimeOfDay).
export function timeOfDayFor(gap) {
  return (stageFor(gap).number - 1) % TIMES_OF_DAY;
}

// The share of moving obstacles for the obstacle in `gap`: none before MOVING_FROM,
// then the stage's share.
export function movingShareFor(gap) {
  return gap >= MOVING_FROM ? stageFor(gap).movingShare : 0;
}
