// Builds the art the game loads (PHASER_PLAN.md, section 5) into public/art/: each
// piece's frames (the custom picture from art/custom/ where there is one, else the
// generated SVG) rasterized by resvg and packed into atlases per set (boot, main) and
// scale (1×, 2×, 4×); the backdrop tiles as images of their own; and pieces.json,
// which tells the game where everything is. Runs before `npm run build` and `npm run dev`;
// stops on a mistake in the custom art (`npm run art:check` says more).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ATLAS_SCALES, TILE_EDGE, cellOf, placement, tileImage } from '../src/art/catalog.js';
import { readCustom } from '../src/art/custom.js';
import { pack } from '../src/art/pack.js';
import { frameName } from '../src/art/piece.js';

const root = new URL('../art/', import.meta.url);
const out = new URL('../public/art/', import.meta.url);
const PADDING = 2;
const MAX_PAGE = 4096;
// Texture memory (RGBA, 4 bytes a pixel) the game may load at an atlas scale, every set
// and tile together. The build fails over a limit: 120 MB at 2× is the budget for the
// iPhone 13 mini (PHASER_PLAN.md, section 6).
// Only large desktop windows load the 4× set; its ceiling keeps it from growing unnoticed.
const LIMITS_MB = { 2: 120, 4: 300 };

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

// Sprite softening is clipped to its own cell, never mixed with adjacent atlas
// frames. Unlike a tile it does not wrap from the right edge to the left edge.
function atlasCellSvg(cell) {
  const { piece, i, x, y, w, h, zoom } = cell;
  if (!piece.soften) return cellSvg(piece, i, cell);
  const once = dataUri('once.png', render(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${cellSvg(piece, i, { ...cell, x: 0, y: 0 })}</svg>`));
  const id = `soften-${piece.key}-${i}`;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" overflow="hidden"><filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${piece.soften * zoom} 0"/></filter><image width="${w}" height="${h}" href="${once}" filter="url(#${id})"/></svg>`;
}

const render = (svg) => new Resvg(svg, { shapeRendering: 2, imageRendering: 0 }).render().asPng();

// The folder is updated in place (a running dev server keeps watching it); files from an
// earlier build that this one does not write are removed at the end.
mkdirSync(new URL('tiles/', out), { recursive: true });
const written = new Set();
const write = (name, data) => {
  writeFileSync(new URL(name, out), data);
  written.add(name);
};
const sizes = {};
const memory = Object.fromEntries(ATLAS_SCALES.map((s) => [s, 0])); // bytes per atlas scale, tiles included
const pieces = manifest.pieces;
const sets = [...new Set(pieces.map((p) => p.set))];

for (const scale of ATLAS_SCALES) {
  // At least 2048 wide: some pieces have a density of their own (the temple's stone).
  const width = Math.min(Math.max(2048, 1024 * scale), MAX_PAGE);
  for (const set of sets) {
    const cells = pieces
      .filter((p) => p.set === set && p.kind !== 'tile')
      // Strips go on each set's first page: Phaser 4.2.1's Rope draws from a multi-page
      // atlas's first image whatever page its frame is on.
      .flatMap((piece) => piece.frames.map((_, i) => ({ piece, i, name: frameName(piece, i), first: piece.kind === 'strip', ...cellOf(piece, scale) })));
    if (cells.length === 0) continue;
    const pages = pack(cells, { width, maxHeight: MAX_PAGE, padding: PADDING });
    const textures = pages.map((page, n) => {
      const image = `${set}@${scale}x-${n}.png`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}">${page.cells.map(atlasCellSvg).join('')}</svg>`;
      write(image, render(svg));
      sizes[image] = `${page.width} × ${page.height}`;
      memory[scale] += page.width * page.height * 4;
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
    write(`${set}@${scale}x.json`, JSON.stringify({ textures }));
  }
}

// A tile with `soften`, blurred sideways by that many units: rendered once, then placed
// three times side by side under the blur and cut back to one, so the blur wraps around
// as the tile repeats. In sRGB, as the game blends (SVG filters default to linear light).
function softened(piece, cell, svg) {
  if (!piece.soften) return svg;
  const once = dataUri('once.png', render(svg));
  const copy = (x) => `<image x="${x}" y="0" width="${cell.w}" height="${cell.h}" href="${once}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="${cell.h}"><filter id="soften" x="${-cell.w}" y="0" width="${3 * cell.w}" height="${cell.h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${piece.soften * cell.zoom} 0"/></filter><g filter="url(#soften)">${copy(-cell.w)}${copy(0)}${copy(cell.w)}</g></svg>`;
}

// The tiles, each an image of its own at each scale it is made at (see tileZoom).
for (const piece of pieces.filter((p) => p.kind === 'tile')) {
  for (const scale of ATLAS_SCALES) {
    const cell = { x: 0, y: 0, ...cellOf(piece, scale) };
    const image = tileImage(piece, scale);
    if (!written.has(image)) {
      // The tile between its edge rows (see TILE_EDGE), each a copy of the row next to it:
      // the rendered tile placed again, one pixel row of it showing.
      const tile = dataUri('tile.png', render(softened(piece, cell, `<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="${cell.h}">${cellSvg(piece, 0, cell)}</svg>`)));
      const placed = (y) => `<image x="0" y="${y}" width="${cell.w}" height="${cell.h}" href="${tile}"/>`;
      const row = (y, from) => `<svg y="${y}" width="${cell.w}" height="1">${placed(-from)}</svg>`;
      const edges = Array.from({ length: TILE_EDGE }, (_, i) => row(i, 0) + row(TILE_EDGE + cell.h + i, cell.h - 1)).join('');
      const h = cell.h + 2 * TILE_EDGE;
      write(image, render(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="${h}">${edges}${placed(TILE_EDGE)}</svg>`));
      sizes[image] = `${cell.w} × ${h}`;
    }
    memory[scale] += cell.w * (cell.h + 2 * TILE_EDGE) * 4;
  }
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
          at: Object.fromEntries(ATLAS_SCALES.map((s) => [s, placement(piece, s, sidecar.pivot)])),
        },
      ];
    }),
  ),
};
write('pieces.json', JSON.stringify(catalog));
// For the gallery: which frames are custom, and the contracts.
write('custom.json', JSON.stringify(custom.replace));
write('manifest.json', JSON.stringify(manifest));
for (const dir of ['', 'tiles/']) {
  for (const name of readdirSync(new URL(dir, out))) {
    if (name !== 'tiles' && !written.has(dir + name)) rmSync(new URL(dir + name, out));
  }
}
const replaced = Object.keys(custom.replace).length;
console.log(
  `public/art/: ${pieces.length} pieces${replaced ? ` (${replaced} frames custom)` : ''} in ${Math.round(performance.now() - start)} ms\n` +
    Object.entries(sizes)
      .map(([name, size]) => `  ${name.padEnd(28)} ${size}`)
      .join('\n') +
    `\ntexture memory: ${ATLAS_SCALES.map((s) => `${(memory[s] / 1e6).toFixed(0)} MB at ${s}×`).join(', ')} (limits ${Object.entries(LIMITS_MB).map(([s, mb]) => `${mb} MB at ${s}×`).join(', ')})`,
);
const over = Object.entries(LIMITS_MB).filter(([s, mb]) => memory[s] > mb * 1e6);
for (const [s, mb] of over) console.error(`The art needs ${(memory[s] / 1e6).toFixed(0)} MB of texture memory at ${s}×, over the limit of ${mb} MB.`);
if (over.length) process.exit(1);
