// M1 spike: packs the generated pieces into texture atlases at 1× and 2× with resvg
// (art/build/atlas@1x.png and @2x, Phaser "JSON hash" atlases), and renders the backdrop
// layers to images of their own at 1× (soft scenery, stretched on 2× screens). Also
// writes art/build/pieces.json: each piece's frames, anchor and zoom, for the rigs.
// A custom piece in art/custom/<key>.svg or .png (or <key>.<frame>.*) replaces the
// generated one. Prints the atlas sizes and how long it took.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('../../art/', import.meta.url);
const out = new URL('build/', root);
mkdirSync(out, { recursive: true });
const { pieces } = JSON.parse(readFileSync(new URL('manifest.json', root)));
const PADDING = 2;
const BACKDROP = (piece) => piece.key.startsWith('backdrop.');

const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const frameName = (piece, i) => (piece.frames.length === 1 ? piece.key : `${piece.key}.${i}`);

// The custom picture for a frame, if there is one: an SVG (used as it is, in the piece's
// box) or a PNG (stretched over the piece's box).
function custom(piece, i) {
  for (const ext of ['svg', 'png']) {
    const url = new URL(`custom/${frameName(piece, i)}.${ext}`, root);
    if (existsSync(url)) return { ext, data: readFileSync(url) };
  }
  return null;
}

// The SVG for one frame, filling a cell of w × h px at `zoom` px per unit, origin at the
// box's corner (the cell can be up to a pixel larger than the box: the view box grows
// with it, so nothing is stretched).
function cellSvg(piece, i, x, y, w, h, zoom) {
  const { box } = piece;
  const replaced = custom(piece, i);
  if (replaced?.ext === 'png') {
    const href = `data:image/png;base64,${replaced.data.toString('base64')}`;
    return `<image x="${x}" y="${y}" width="${box.w * zoom}" height="${box.h * zoom}" preserveAspectRatio="none" href="${href}"/>`;
  }
  const svg = replaced ? replaced.data.toString('utf8') : readFileSync(new URL(piece.frames[i], root), 'utf8');
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${box.x} ${box.y} ${w / zoom} ${h / zoom}" overflow="hidden">${inner(svg)}</svg>`;
}

const start = performance.now();
const info = {};
for (const atlasScale of [1, 2]) {
  // Shelf packing, tallest first, into an atlas `width` px wide.
  const width = 1024 * atlasScale;
  const cells = [];
  for (const piece of pieces.filter((p) => !BACKDROP(p))) {
    const zoom = piece.scale * atlasScale;
    piece.frames.forEach((_, i) =>
      cells.push({ piece, i, zoom, w: Math.ceil(piece.box.w * zoom), h: Math.ceil(piece.box.h * zoom) }),
    );
  }
  cells.sort((a, b) => b.h - a.h);
  let x = PADDING;
  let y = PADDING;
  let shelf = 0;
  for (const cell of cells) {
    if (x + cell.w + PADDING > width) {
      x = PADDING;
      y += shelf + PADDING;
      shelf = 0;
    }
    Object.assign(cell, { x, y });
    x += cell.w + PADDING;
    shelf = Math.max(shelf, cell.h);
  }
  const height = Math.ceil((y + shelf + PADDING) / 4) * 4;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    cells.map((c) => cellSvg(c.piece, c.i, c.x, c.y, c.w, c.h, c.zoom)).join('') +
    '</svg>';
  const image = `atlas@${atlasScale}x.png`;
  writeFileSync(new URL(image, out), new Resvg(svg, { shapeRendering: 2 }).render().asPng());
  const frames = {};
  for (const c of cells) {
    frames[frameName(c.piece, c.i)] = {
      frame: { x: c.x, y: c.y, w: c.w, h: c.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: c.w, h: c.h },
      sourceSize: { w: c.w, h: c.h },
    };
  }
  writeFileSync(new URL(`atlas@${atlasScale}x.json`, out), JSON.stringify({ frames, meta: { image, size: { w: width, h: height }, scale: 1 } }));
  info[`atlas@${atlasScale}x`] = `${width} × ${height} (${((width * height * 4) / 2 ** 20).toFixed(1)} MB as a texture)`;
}

// The backdrop layers, each an image of its own at 1×.
for (const piece of pieces.filter(BACKDROP)) {
  const { box } = piece;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}">${cellSvg(piece, 0, 0, 0, box.w, box.h, 1)}</svg>`;
  writeFileSync(new URL(`${piece.key}@1x.png`, out), new Resvg(svg, { shapeRendering: 2 }).render().asPng());
  info[piece.key] = `${box.w} × ${box.h} (${((box.w * box.h * 4) / 2 ** 20).toFixed(1)} MB as a texture)`;
}

// For the rigs: each piece's frame names, its anchor (the origin, as a share of the
// frame's width and height) and how many atlas pixels make one unit.
const rigInfo = {};
for (const atlasScale of [1, 2]) {
  rigInfo[atlasScale] = Object.fromEntries(
    pieces.map((piece) => {
      const zoom = BACKDROP(piece) ? 1 : piece.scale * atlasScale;
      const w = BACKDROP(piece) ? piece.box.w : Math.ceil(piece.box.w * zoom);
      const h = BACKDROP(piece) ? piece.box.h : Math.ceil(piece.box.h * zoom);
      return [
        piece.key,
        { frames: piece.frames.map((_, i) => frameName(piece, i)), anchor: [(-piece.box.x * zoom) / w, (-piece.box.y * zoom) / h], zoom },
      ];
    }),
  );
}
writeFileSync(new URL('pieces.json', out), JSON.stringify(rigInfo));
console.log(JSON.stringify(info, null, 1), `\n${Math.round(performance.now() - start)} ms`);
