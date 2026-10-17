// Checks the custom art in art/custom/ against the pieces' contracts (art/manifest.json;
// docs/plans/art-pipeline.md): names, sizes, aspects and sidecars (errors), and how far an
// obstacle's art strays from its hitbox (warnings: the hitbox is gameplay and does not
// follow the art). `npm run art:check`; CI runs it too.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { hitboxStray, imageSize, readCustom } from '../src/art/custom.js';
import { validatePack } from '../src/art/packs.js';
import { cartoonInventory } from '../src/art/cartoonInventory.js';

const root = new URL('../art/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const dir = new URL('custom/', root);
const files = existsSync(dir) ? Object.fromEntries(readdirSync(dir).map((name) => [name, readFileSync(new URL(name, dir))])) : {};
const { replace, errors } = readCustom(manifest, files);
const cartoonDir = new URL('packs/cartoon/', root);
const cartoon = JSON.parse(readFileSync(new URL('manifest.json', cartoonDir), 'utf8'));
errors.push(...validatePack(manifest, cartoon, 'cartoon'));
const layout = JSON.parse(readFileSync(new URL('source-layout.json', cartoonDir), 'utf8'));
for (const [key, { source, cell }] of Object.entries(layout.components)) {
  const file = new URL(source, cartoonDir);
  const size = existsSync(file) ? imageSize(source, readFileSync(file)) : null;
  if (!size || ![cell.x, cell.y, cell.w, cell.h].every(Number.isFinite) || cell.x < 0 || cell.y < 0 || cell.w <= 0 || cell.h <= 0 || cell.x + cell.w > size.width || cell.y + cell.h > size.height) errors.push(`Invalid cartoon master crop: ${key}`);
}
const inventory = JSON.parse(readFileSync(new URL('inventory.json', cartoonDir), 'utf8'));
if (JSON.stringify(cartoonInventory(manifest, inventory)) !== JSON.stringify(inventory)) errors.push('Cartoon inventory is out of sync');
for (const piece of cartoon.pieces) for (const frame of piece.frames) {
  if (!existsSync(new URL(frame, cartoonDir))) errors.push(`Missing cartoon source: ${frame}`);
}
for (const piece of inventory.pieces) for (const frame of piece.frames) {
  if (!frame.source || !['painted', 'reviewed'].includes(frame.status)) errors.push(`Unfinished cartoon frame: ${frame.key}`);
}

// The opaque bounds of a picture stretched over a piece's box, in the piece's units.
function drawnBounds(piece, name) {
  const zoom = 4;
  const { box } = piece;
  const [w, h] = [Math.ceil(box.w * zoom), Math.ceil(box.h * zoom)];
  const href = `data:${name.endsWith('.png') ? 'image/png' : 'image/svg+xml'};base64,${files[name].toString('base64')}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image width="${w}" height="${h}" preserveAspectRatio="none" href="${href}"/></svg>`;
  const image = new Resvg(svg).render();
  const { pixels, width, height } = image;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 32) continue;
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x + 1), Math.max(y1, y + 1)];
    }
  }
  if (x0 === Infinity) return null;
  return { x0: box.x + x0 / zoom, x1: box.x + x1 / zoom, y0: box.y + y0 / zoom, y1: box.y + y1 / zoom };
}

const warnings = [];
for (const [frame, name] of Object.entries(replace)) {
  const piece = manifest.pieces.find((p) => frame === p.key || frame.startsWith(`${p.key}.`));
  if (!piece?.hitbox) continue;
  const drawn = drawnBounds(piece, name);
  const stray = drawn ? hitboxStray(drawn, piece.hitbox) : 'nothing is drawn';
  if (stray) warnings.push(`${name}: ${stray}`);
}

for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);
const count = Object.keys(files).filter((n) => !n.startsWith('.') && n !== 'README.md').length;
console.log(`art/custom: ${count} files, ${Object.keys(replace).length} frames replaced, ${errors.length} errors, ${warnings.length} warnings`);
process.exitCode = errors.length ? 1 : 0;
