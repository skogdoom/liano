import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The Phaser version must not pull in Pixi (each version downloads only its own library,
// PHASER_PLAN.md section 3): what it shares with the Pixi version lives in Pixi-free
// modules (src/views/ and the like).
const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

function importsOf(file) {
  const code = readFileSync(file, 'utf8');
  return [...code.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]);
}

// Every module `entry` reaches through its static imports, and the packages they import.
function reach(entry) {
  const files = new Set();
  const packages = new Set();
  const visit = (file) => {
    if (files.has(file)) return;
    files.add(file);
    for (const spec of importsOf(file)) {
      if (spec.startsWith('.')) {
        if (spec.endsWith('.js')) visit(resolve(dirname(file), spec));
      } else packages.add(spec);
    }
  };
  visit(entry);
  return { files, packages };
}

describe('the Phaser version’s modules', () => {
  it('import no Pixi, directly or through what they share', () => {
    const { files, packages } = reach(resolve(src, 'phaser/main.js'));
    expect(packages.has('pixi.js')).toBe(false);
    expect([...files].filter((f) => f.includes('/render/') && !/\/(camera|interpolate|shake|shapes|fpsMeter)\.js$/.test(f))).toEqual([]);
    expect(packages.has('phaser')).toBe(true);
  });
});
