// Node module hooks for the dev scripts: lets the game's modules import JSON as Vite
// does (`import table from './x.json'`, `import { version } from './package.json'`),
// without import attributes.
import { readFileSync } from 'node:fs';

export async function load(url, context, nextLoad) {
  if (url.endsWith('.json')) {
    const json = readFileSync(new URL(url), 'utf8');
    const value = JSON.parse(json);
    // Top-level keys that are names become named exports too.
    const named = value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value).map((key, i) => `const v${i} = data[${JSON.stringify(key)}]; export { v${i} as ${JSON.stringify(key)} };`)
      : [];
    return { format: 'module', shortCircuit: true, source: [`const data = ${json};`, 'export default data;', ...named].join('\n') };
  }
  return nextLoad(url, context);
}
