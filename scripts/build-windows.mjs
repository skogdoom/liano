// Precomputes the release window for every obstacle type and height, so the game
// only looks them up. Runs before `npm run build`; run `npm run windows` after
// changing a tunable in src/config.js (the tests fail until you do).
import { writeFileSync } from 'node:fs';
import { computeWindowTable } from '../src/sim/feasibility.js';

const start = Date.now();
const table = computeWindowTable();
// One line per variant, scale and type keeps the file small and diffs readable.
const block = (indent, entries, inner) =>
  entries.map(([key, value]) => `${indent}${JSON.stringify(key)}: ${inner(value, indent)}`).join(',\n');
const lines = [
  block('    ', Object.entries(table.windows), (scales, indent) => {
    const rows = block(`${indent}  `, Object.entries(scales), (types, i2) => {
      const typeRows = block(`${i2}  `, Object.entries(types), (w) => JSON.stringify(w));
      return `{\n${typeRows}\n${i2}}`;
    });
    return `{\n${rows}\n${indent}}`;
  }),
];
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
