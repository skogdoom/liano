// Precomputes the release window for every obstacle type and height, so the game
// only looks them up. Runs before `npm run build`; run `npm run windows` after
// changing a tunable in src/config.js (the tests fail until you do).
import { writeFileSync } from 'node:fs';
import { computeWindowTable } from '../src/sim/feasibility.js';

const start = Date.now();
const table = computeWindowTable();
// One line per type keeps the file small and diffs readable.
const lines = Object.entries(table.windows).map(([type, w]) => `    ${JSON.stringify(type)}: ${JSON.stringify(w)}`);
const json = `{
  "inputs": ${JSON.stringify(table.inputs)},
  "minY": ${table.minY},
  "maxY": ${table.maxY},
  "windows": {
${lines.join(',\n')}
  }
}
`;
writeFileSync(new URL('../src/sim/windowTable.json', import.meta.url), json);
console.log(`src/sim/windowTable.json (${Date.now() - start} ms)`);
