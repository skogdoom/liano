import table from './windowTable.json';
import { isFeasible, windowInputs, MIN_WINDOW_STEPS, PERIODS } from './feasibility.js';

// Passability lookups from the table built by scripts/build-windows.mjs, so play
// never runs the solver. If the table was built from different tunables (a config
// change without `npm run windows`), fall back to the solver rather than trust it.
const fresh = JSON.stringify(table.inputs) === JSON.stringify(windowInputs());
if (!fresh) console.warn('windowTable.json is out of date; run `npm run windows`. Using the solver meanwhile.');

export const tableIsFresh = fresh;

// Same answer as isFeasible(type, y, scale, minSteps, boosted), from the table when
// possible.
export function isPassable(type, y, scale = 1, minSteps = MIN_WINDOW_STEPS, boosted = false) {
  const rows = Object.keys(PERIODS).map((variant) => table.windows[variant]?.[scale]?.[type]);
  if (fresh && rows.every(Boolean) && Number.isInteger(y) && y >= table.minY && y <= table.maxY) {
    const i = y - table.minY;
    // The normal swing, and with `boosted` every boosted one too.
    return (boosted ? rows : rows.slice(0, 1)).every((row) => row[i] >= minSteps);
  }
  return isFeasible(type, y, scale, minSteps, boosted);
}
