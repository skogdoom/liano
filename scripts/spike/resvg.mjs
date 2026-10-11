// M1 spike: rasterizes every generated piece frame with resvg at 1× and 2× (times the
// piece's own scale) into art/build/resvg/, for spike/compare.html to compare against
// Pixi and Chromium. Prints how long it took.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('../../art/', import.meta.url);
const out = new URL('build/resvg/', root);
mkdirSync(out, { recursive: true });
const { pieces } = JSON.parse(readFileSync(new URL('manifest.json', root)));
const start = performance.now();
let count = 0;
for (const piece of pieces) {
  for (const file of piece.frames) {
    const svg = readFileSync(new URL(file, root), 'utf8');
    for (const atlasScale of [1, 2]) {
      const zoom = atlasScale * piece.scale;
      const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: zoom }, shapeRendering: 2 }).render().asPng();
      writeFileSync(new URL(`${file.replace('generated/', '').replace(/\.svg$/, '')}@${atlasScale}x.png`, out), png);
      count++;
    }
  }
}
console.log(`resvg: ${count} images in ${Math.round(performance.now() - start)} ms`);
