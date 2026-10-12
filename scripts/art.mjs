// Writes the pre-rendered art's sources (PHASER_PLAN.md, section 5): each piece's frames
// as SVG into art/generated/, with art/manifest.json describing them (src/art/generate.js,
// the pieces in src/art/pieces/). `npm run art` after changing a piece's drawing code;
// like the window table, the output is committed and the tests fail until it is up to date.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { generateArt } from '../src/art/generate.js';
import { PIECES } from '../src/art/pieces/index.js';

const root = new URL('../art/', import.meta.url);
const dir = new URL('generated/', root);
const { files, manifest } = generateArt(PIECES);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const [name, svg] of Object.entries(files)) writeFileSync(new URL(name, dir), svg);
writeFileSync(new URL('manifest.json', root), manifest);
console.log(`art/: ${PIECES.length} pieces, ${Object.keys(files).length} frames`);
