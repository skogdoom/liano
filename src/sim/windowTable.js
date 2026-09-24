import table from './windowTable.json';
import { isFeasible, windowInputs, MIN_WINDOW_STEPS } from './feasibility.js';

// Passability lookups from the table built by scripts/build-windows.mjs, so play
// never runs the solver. If the table was built from different tunables (a config
// change without `npm run windows`), fall back to the solver rather than trust it.
const fresh = JSON.stringify(table.inputs) === JSON.stringify(windowInputs());
if (!fresh) console.warn('windowTable.json is out of date; run `npm run windows`. Using the solver meanwhile.');

export const tableIsFresh = fresh;

// Same answer as isFeasible(type, y), from the table when possible.
export function isPassable(type, y) {
  if (fresh && Number.isInteger(y) && y >= table.minY && y <= table.maxY) {
    return table.windows[type][y - table.minY] >= MIN_WINDOW_STEPS;
  }
  return isFeasible(type, y);
}
