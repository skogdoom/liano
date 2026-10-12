// Writes the pre-rendered art's sources (PHASER_PLAN.md, section 5): each piece's frames
// as SVG into art/generated/, with art/manifest.json describing them (src/art/generate.js).
// `npm run art` after changing a piece's drawing code; like the window table, the output
// is committed and the tests fail until it is up to date.
//
// M1: the spike's pieces only (src/art/spike.js).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { generateArt } from '../src/art/generate.js';
import { SPIKE_PIECES } from '../src/art/spike.js';

const root = new URL('../art/', import.meta.url);
const dir = new URL('generated/', root);
const { files, manifest } = generateArt(SPIKE_PIECES);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const [name, svg] of Object.entries(files)) writeFileSync(new URL(name, dir), svg);
writeFileSync(new URL('manifest.json', root), manifest);
console.log(`art/: ${SPIKE_PIECES.length} pieces, ${Object.keys(files).length} frames`);
