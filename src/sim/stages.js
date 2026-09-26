import { STAGES } from '../config.js';

// The stage (1-based number and its row of STAGES) for the obstacle in `gap`.
export function stageFor(gap) {
  let index = 0;
  while (index + 1 < STAGES.length && gap >= STAGES[index + 1].first) index++;
  return { number: index + 1, ...STAGES[index] };
}
