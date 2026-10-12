// Compares two dumps from dump-views.mjs and prints where they first differ in each
// section (or that they are the same).
//   node scripts/dev/diff-dumps.mjs before.json after.json
import { readFileSync } from 'node:fs';

const [a, b] = process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, 'utf8')));

function firstDifference(x, y, path) {
  if (JSON.stringify(x) === JSON.stringify(y)) return null;
  if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) return { path, before: x, after: y };
  for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const found = firstDifference(x[key], y[key], `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

let same = true;
for (const section of new Set([...Object.keys(a), ...Object.keys(b)])) {
  const found = firstDifference(a[section], b[section], section);
  if (!found) continue;
  same = false;
  console.log(`${found.path}\n  before: ${JSON.stringify(found.before)?.slice(0, 300)}\n  after:  ${JSON.stringify(found.after)?.slice(0, 300)}`);
}
console.log(same ? 'same' : 'different');
process.exitCode = same ? 0 : 1;
