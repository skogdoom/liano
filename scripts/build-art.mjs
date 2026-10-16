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
import { validatePack } from '../src/art/packs.js';

const artRoot = new URL('../art/', import.meta.url);
const outputRoot = new URL('../public/art/', import.meta.url);
const PADDING = 2;
const EXTRUSION = 1; // One texel per side covers bilinear sampling without sharing margins.
const MAX_PAGE = 4096;
// Texture memory (RGBA, 4 bytes a pixel) the game may load at an atlas scale, every set
// and tile together. The build fails over a limit: 120 MB at 2× is the budget for the
// iPhone 13 mini (PHASER_PLAN.md, section 6).
// Only large desktop windows load the 4× set; its ceiling keeps it from growing unnoticed.
const LIMITS_MB = { 2: 120, 4: 300 };

function buildPack(id, root, manifest) {
  const start = performance.now();
  const out = new URL(`${id}/`, outputRoot);
  const customDir = new URL('custom/', root);
  const customFiles = existsSync(customDir)
    ? Object.fromEntries(readdirSync(customDir).map((name) => [name, readFileSync(new URL(name, customDir))]))
    : {};
  const custom = readCustom(manifest, customFiles);
  if (id === 'cartoon') custom.errors.push(...validatePack(classic, manifest, id, custom.sidecars));
  if (custom.errors.length) {
    console.error(`${id === 'classic' ? 'art/custom' : 'art/packs/cartoon/custom'} has mistakes:\n  ${custom.errors.join('\n  ')}`);
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

  const render = (svg) => new Resvg(svg, { shapeRendering: 2, imageRendering: 0, font: { loadSystemFonts: id === 'classic' } }).render().asPng();

  // Rasterize each cartoon cell in isolation, then extrude one pixel per side.
  // The two-pixel gap reserves both margins. Extruding two per side into that
  // shared gap leaked opaque neighbors into transparent sprite edges.
  function extrudedCell(cell) {
    const { x, y, w, h } = cell;
    const rendered = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${atlasCellSvg({ ...cell, x: 0, y: 0 })}</svg>`, { font: { loadSystemFonts: false } }).render();
    let maximumAlpha = 0;
    const pixels = rendered.pixels;
    for (let i = 3; i < pixels.length; i += 4) maximumAlpha = Math.max(maximumAlpha, pixels[i]);
    if (!maximumAlpha) throw new Error(`Empty cartoon frame: ${cell.name}`);
    if (cell.piece.alpha !== undefined && maximumAlpha > Math.ceil(cell.piece.alpha * 255) + 1) throw new Error(`Wrong alpha in cartoon frame: ${cell.name}`);
    const once = dataUri('cell.png', rendered.asPng());
    const id = `cell-${cell.name.replaceAll('.', '-')}`;
    const copy = (dx, dy, dw, dh, sx, sy, sw, sh) => `<svg x="${dx}" y="${dy}" width="${dw}" height="${dh}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" overflow="hidden"><use href="#${id}"/></svg>`;
    return `<defs><image id="${id}" width="${w}" height="${h}" href="${once}"/></defs>` + copy(x, y, w, h, 0, 0, w, h)
      + copy(x - EXTRUSION, y, EXTRUSION, h, 0, 0, 1, h) + copy(x + w, y, EXTRUSION, h, w - 1, 0, 1, h)
      + copy(x, y - EXTRUSION, w, EXTRUSION, 0, 0, w, 1) + copy(x, y + h, w, EXTRUSION, 0, h - 1, w, 1)
      + [[-EXTRUSION, -EXTRUSION, 0, 0], [w, -EXTRUSION, w - 1, 0], [-EXTRUSION, h, 0, h - 1], [w, h, w - 1, h - 1]]
        .map(([dx, dy, sx, sy]) => copy(x + dx, y + dy, EXTRUSION, EXTRUSION, sx, sy, 1, 1)).join('');
  }

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
  const frameCells = {};
  // Presentation may enlarge a painted sprite beyond its baseline rig size.
  // Rasterize that frame more densely; its logical box/pivot stay unchanged and
  // the catalog's zoom cancels the extra pixels when Art creates an image.
  const rasterScale = manifest.presentation?.rasterScale ?? {};
  for (const [key, factor] of Object.entries(rasterScale)) {
    const piece = manifest.pieces.find(piece => piece.key === key);
    if (!piece || piece.kind === 'tile' || !Number.isFinite(factor) || factor < 1 || factor > 4) throw new Error(`Invalid raster scale: ${key}`);
  }
  const pieces = manifest.pieces.map(piece => rasterScale[piece.key]
    ? { ...piece, scale: piece.scale * rasterScale[piece.key] } : piece);
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
        console.log(`rasterizing ${id} ${set} ${scale}× page ${n}`);
        const image = `${set}@${scale}x-${n}.png`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}">${page.cells.map(id === 'cartoon' ? extrudedCell : atlasCellSvg).join('')}</svg>`;
        write(image, render(svg));
        sizes[image] = `${page.width} × ${page.height}`;
        memory[scale] += page.width * page.height * 4;
        if (scale === 2) for (const cell of page.cells) frameCells[cell.name] = { sheet: image, cell: { x: cell.x, y: cell.y, w: cell.w, h: cell.h } };
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
        console.log(`rasterizing ${id} tile ${piece.key} ${scale}×`);
        // The tile between its edge rows (see TILE_EDGE), each a copy of the row next to it:
        // the rendered tile placed again, one pixel row of it showing.
        // Paint sources with repeated vector groups directly in the root viewport.
        // resvg 2.6 can panic clipping an off-screen group in a nested SVG viewport.
        const source = id === 'cartoon'
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="${cell.h}" viewBox="${piece.box.x} ${piece.box.y} ${cell.w / cell.zoom} ${cell.h / cell.zoom}">${inner(readFileSync(new URL(piece.frames[0], root), 'utf8'))}</svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="${cell.w}" height="${cell.h}">${cellSvg(piece, 0, cell)}</svg>`;
        const tile = dataUri('tile.png', render(softened(piece, cell, source)));
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
    pack: id,
    ...(manifest.presentation && { presentation: manifest.presentation }),
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
  const downloadBytes = Object.fromEntries(ATLAS_SCALES.map((scale) => {
    const files = new Set(['pieces.json']);
    for (const set of sets) {
      files.add(`${set}@${scale}x.json`);
      const atlas = JSON.parse(readFileSync(new URL(`${set}@${scale}x.json`, out)));
      for (const texture of atlas.textures) files.add(texture.image);
    }
    for (const piece of pieces.filter((p) => p.kind === 'tile')) files.add(tileImage(piece, scale));
    return [scale, [...files].reduce((sum, file) => sum + readFileSync(new URL(file, out)).length, 0)];
  }));
  write('metrics.json', JSON.stringify({ pack: id, memory, downloadBytes }));
  if (id === 'cartoon') {
    const file = new URL('inventory.json', root);
    const inventory = JSON.parse(readFileSync(file, 'utf8'));
    for (const piece of inventory.pieces) for (const frame of piece.frames) {
      const placement = frameCells[frame.key];
      if (placement) Object.assign(frame, placement);
      else {
        const { w, h } = cellOf(piece, 2);
        frame.sheet = tileImage(piece, 2); frame.cell = { x: 0, y: TILE_EDGE, w, h };
      }
    }
    writeFileSync(file, JSON.stringify(inventory, null, 2) + '\n');
  }
  for (const dir of ['', 'tiles/']) {
    for (const name of readdirSync(new URL(dir, out))) {
      if (name !== 'tiles' && !written.has(dir + name)) rmSync(new URL(dir + name, out));
    }
  }
  const replaced = Object.keys(custom.replace).length;
  console.log(
    `public/art/${id}/: ${pieces.length} pieces${replaced ? ` (${replaced} frames custom)` : ''} in ${Math.round(performance.now() - start)} ms\n` +
      Object.entries(sizes)
        .map(([name, size]) => `  ${name.padEnd(28)} ${size}`)
        .join('\n') +
      `\ntexture memory: ${ATLAS_SCALES.map((s) => `${(memory[s] / 1e6).toFixed(0)} MB at ${s}×`).join(', ')} (limits ${Object.entries(LIMITS_MB).map(([s, mb]) => `${mb} MB at ${s}×`).join(', ')})`,
  );
  const over = Object.entries(LIMITS_MB).filter(([s, mb]) => memory[s] > mb * 1e6);
  for (const [s, mb] of over) console.error(`The art needs ${(memory[s] / 1e6).toFixed(0)} MB of texture memory at ${s}×, over the limit of ${mb} MB.`);
  if (over.length) throw new Error(`${id} exceeds the texture budget`);
}

const classic = JSON.parse(readFileSync(new URL('manifest.json', artRoot), 'utf8'));
const cartoonRoot = new URL('packs/cartoon/', artRoot);
const cartoon = JSON.parse(readFileSync(new URL('manifest.json', cartoonRoot), 'utf8'));
const errors = validatePack(classic, cartoon, 'cartoon');
if (errors.length) throw new Error(errors.join('\n'));
// Validate both source sets before replacing either output.
for (const [root, manifest] of [[artRoot, classic], [cartoonRoot, cartoon]]) {
  for (const piece of manifest.pieces) for (const file of piece.frames) {
    if (!existsSync(new URL(file, root))) throw new Error(`Missing pack source: ${file}`);
  }
}
buildPack('classic', artRoot, classic);
buildPack('cartoon', cartoonRoot, cartoon);
// Remove the former single-pack output only after both builds succeed.
for (const name of readdirSync(outputRoot)) {
  if (name !== 'classic' && name !== 'cartoon') rmSync(new URL(name, outputRoot), { recursive: true });
}
