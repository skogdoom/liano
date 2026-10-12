// Builds the art the game loads (PHASER_PLAN.md, section 5) into public/art/: each
// piece's frames (the custom picture from art/custom/ where there is one, else the
// generated SVG) rasterized by resvg and packed into atlases per set (boot, main) and
// scale (1×, 2×, 4×); the backdrop tiles as images of their own at 1×; and pieces.json,
// which tells the game where everything is. Runs before `npm run build` and `npm run dev`;
// stops on a mistake in the custom art (`npm run art:check` says more).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ATLAS_SCALES, cellOf, placement } from '../src/art/catalog.js';
import { readCustom } from '../src/art/custom.js';
import { pack } from '../src/art/pack.js';
import { frameName } from '../src/art/piece.js';

const root = new URL('../art/', import.meta.url);
const out = new URL('../public/art/', import.meta.url);
const PADDING = 2;
const MAX_PAGE = 4096;

const start = performance.now();
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const customDir = new URL('custom/', root);
const customFiles = existsSync(customDir)
  ? Object.fromEntries(readdirSync(customDir).map((name) => [name, readFileSync(new URL(name, customDir))]))
  : {};
const custom = readCustom(manifest, customFiles);
if (custom.errors.length) {
  console.error(`art/custom has mistakes:\n  ${custom.errors.join('\n  ')}`);
  process.exit(1);
}

// An SVG's content without its outer element, and without the hidden guide layer (which
// is never drawn, and names a namespace the outer element declares).
const inner = (svg) =>
  svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<g id="guides"[\s\S]*?<\/g>/, '');
const dataUri = (name, data) => `data:${name.endsWith('.png') ? 'image/png' : 'image/svg+xml'};base64,${data.toString('base64')}`;

// The SVG for one frame in a cell of w × h px at (x, y), `zoom` px per unit: a custom
// picture stretched over the piece's box, or the generated drawing.
function cellSvg(piece, i, { x, y, w, h, zoom }) {
  const { box } = piece;
  const name = frameName(piece, i);
  const replacement = custom.replace[name];
  if (replacement) {
    return `<image x="${x}" y="${y}" width="${box.w * zoom}" height="${box.h * zoom}" preserveAspectRatio="none" href="${dataUri(replacement, customFiles[replacement])}"/>`;
  }
  const svg = readFileSync(new URL(piece.frames[i], root), 'utf8');
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${box.x} ${box.y} ${w / zoom} ${h / zoom}" overflow="hidden">${inner(svg)}</svg>`;
}

const render = (svg) => new Resvg(svg, { shapeRendering: 2, imageRendering: 0 }).render().asPng();

rmSync(out, { recursive: true, force: true });
mkdirSync(new URL('tiles/', out), { recursive: true });
const sizes = {};
const pieces = manifest.pieces;
const sets = [...new Set(pieces.map((p) => p.set))];

for (const scale of ATLAS_SCALES) {
  const width = Math.min(1024 * scale, MAX_PAGE);
  for (const set of sets) {
    const cells = pieces
      .filter((p) => p.set === set && p.kind !== 'tile')
      .flatMap((piece) => piece.frames.map((_, i) => ({ piece, i, name: frameName(piece, i), ...cellOf(piece, scale) })));
    if (cells.length === 0) continue;
    const pages = pack(cells, { width, maxHeight: MAX_PAGE, padding: PADDING });
    const textures = pages.map((page, n) => {
      const image = `${set}@${scale}x-${n}.png`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}">${page.cells.map((c) => cellSvg(c.piece, c.i, c)).join('')}</svg>`;
      writeFileSync(new URL(image, out), render(svg));
      sizes[image] = `${page.width} × ${page.height}`;
      return {
        image,
        format: 'RGBA8888',
        size: { w: page.width, h: page.height },
        scale: 1,
        frames: page.cells.map((c) => ({
          filename: c.name,
          rotated: false,
          trimmed: false,
          frame: { x: c.x, y: c.y, w: c.w, h: c.h },
          spriteSourceSize: { x: 0, y: 0, w: c.w, h: c.h },
          sourceSize: { w: c.w, h: c.h },
        })),
      };
    });
    writeFileSync(new URL(`${set}@${scale}x.json`, out), JSON.stringify({ textures }));
  }
}

// The tiles, each an image of its own at 1×.
for (const piece of pieces.filter((p) => p.kind === 'tile')) {
  const cell = { x: 0, y: 0, ...cellOf(piece, 1) };
  const image = `tiles/${piece.key}@1x.png`;
  writeFileSync(new URL(image, out), render(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="${cell.h}">${cellSvg(piece, 0, cell)}</svg>`));
  sizes[image] = `${cell.w} × ${cell.h}`;
}

// Where everything is, for the game: per piece its contract (and what a sidecar changes)
// and, per atlas scale, its frames' names, anchor and zoom.
const catalog = {
  scales: ATLAS_SCALES,
  sets,
  pieces: Object.fromEntries(
    pieces.map((piece) => {
      const sidecar = custom.sidecars[piece.key] ?? {};
      const { key, kind, set, box, scale, tint, attach, slices, length } = piece;
      const fps = sidecar.fps ?? piece.fps;
      return [
        key,
        {
          kind,
          set,
          box,
          scale,
          tint,
          ...(fps !== undefined && { fps }),
          ...(attach && { attach }),
          ...(slices && { slices }),
          ...(length !== undefined && { length }),
          ...(kind === 'tile' && { image: `tiles/${key}@1x.png` }),
          at: Object.fromEntries(ATLAS_SCALES.map((s) => [s, placement(piece, s, sidecar.pivot)])),
        },
      ];
    }),
  ),
};
writeFileSync(new URL('pieces.json', out), JSON.stringify(catalog));
const replaced = Object.keys(custom.replace).length;
console.log(
  `public/art/: ${pieces.length} pieces${replaced ? ` (${replaced} frames custom)` : ''} in ${Math.round(performance.now() - start)} ms\n` +
    Object.entries(sizes)
      .map(([name, size]) => `  ${name.padEnd(28)} ${size}`)
      .join('\n'),
);
