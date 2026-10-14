import { makeContainer } from './world/build.js';
import { makeText, setTextOrigin } from './text.js';

const TOKENS = [...'0123456789', 'BEST', 'P1', 'P2', 'OUT'];
const PHASES = 4;
const caches = new WeakMap();
const preparing = new WeakMap();
let nextKey = 0;

// HUD glyphs are finite; scores are not. Rasterize and upload one small atlas per
// font/colour/resolution during layout, then change only Image positions and frames.
// Whole-line measurement preserves the font's proportional spacing and kerning.
function atlasFor(scene, options, resolution) {
  let cache = caches.get(scene);
  if (!cache) {
    caches.set(scene, cache = new Map());
    scene.events.once('shutdown', () => {
      for (const atlas of cache.values()) scene.textures.remove(atlas.key);
      cache.clear();
    });
  }
  const signature = JSON.stringify({ ...options, resolution });
  preparing.get(scene)?.add(signature);
  if (cache.has(signature)) return cache.get(signature);
  // Cache quarter-pixel raster phases too. Moving an integer-rasterized glyph to
  // a fractional advance only with GPU filtering makes small digits look different
  // from a complete Canvas line, especially at 1×.
  const texts = TOKENS.flatMap((token) => Array.from({ length: PHASES }, (_, phase) => {
    const text = setTextOrigin(makeText(scene, token, { ...options, resolution }), 0, 0);
    text.padding.left += phase / PHASES / resolution;
    text.updateText();
    return text;
  }));
  const cells = [];
  let rowX = 0, rowY = 1, rowHeight = 0, width = 0;
  for (const text of texts) {
    if (rowX + text.canvas.width + 2 > 2048) { rowY += rowHeight + 2; rowX = 0; rowHeight = 0; }
    cells.push({ x: rowX, y: rowY });
    rowX += text.canvas.width + 2;
    width = Math.max(width, rowX);
    rowHeight = Math.max(rowHeight, text.canvas.height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = rowY + rowHeight + 1;
  const context = canvas.getContext('2d');
  const key = `hud.glyphs.${nextKey++}`;
  const frames = [];
  const glyphs = new Map();
  texts.forEach((text, i) => {
    const { x, y } = cells[i];
    context.drawImage(text.canvas, x, y);
    const char = `${TOKENS[Math.floor(i / PHASES)]}:${i % PHASES}`;
    frames.push([char, 0, x, y, text.canvas.width, text.canvas.height]);
    glyphs.set(char, { left: text.padding.left, top: text.padding.top });
  });
  const first = texts[0];
  const atlas = { key, glyphs, resolution, context: first.context, height: first.height - first.padding.top - first.padding.bottom, distance: options.shadow?.distance ?? 0 };
  // Keep a separate measurement canvas: the temporary Text objects can all die.
  atlas.context = document.createElement('canvas').getContext('2d');
  atlas.context.font = first.context.font;
  texts.forEach((text) => text.destroy());
  const texture = scene.textures.addCanvas(key, canvas);
  frames.forEach((frame) => texture.add(...frame));
  cache.set(signature, atlas);
  return atlas;
}

// Keep only the resolutions this layout needs. Repeated window resizes must not
// retain every old glyph atlas; mode variants at the current layout stay prepared.
export function prepareGlyphLabels(scene, prepare) {
  const needed = new Set();
  preparing.set(scene, needed);
  try { prepare(); } finally { preparing.delete(scene); }
  const cache = caches.get(scene);
  for (const [signature, atlas] of cache ?? []) {
    if (needed.has(signature)) continue;
    scene.textures.remove(atlas.key);
    cache.delete(signature);
  }
}

export function glyphLabel(scene, options) {
  const view = makeContainer(scene);
  const images = [];
  let atlas = null, content = '', originX = 1, originY = 0;
  const layout = () => {
    if (!atlas) return view;
    const { context, resolution, distance, height } = atlas;
    const metrics = context.measureText(content);
    view.pixiWidth = Math.max(metrics.width, metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight) + (options.strokeWidth ?? 0) + distance;
    const textureSize = (n) => Math.ceil(Math.ceil(n) * resolution) / resolution;
    const left = originX * textureSize(view.pixiWidth);
    const top = originY * textureSize(height + distance);
    let count = 0;
    const tokens = [...content.matchAll(/BEST|OUT|P[12]|[0-9]| +/g)];
    if (tokens.map(([token]) => token).join('') !== content) throw new Error(`Uncached HUD text: ${content}`);
    for (const match of tokens) {
      const [char] = match;
      const i = match.index;
      if (char[0] === ' ') continue;
      const advance = context.measureText(content.slice(0, i + char.length)).width - context.measureText(char).width;
      const phase = Math.round((advance * resolution % 1) * PHASES) % PHASES;
      const frame = `${char}:${phase}`;
      const glyph = atlas.glyphs.get(frame);
      let image = images[count++];
      if (!image) {
        image = scene.make.image({ key: atlas.key, frame }, false).setOrigin(0, 0);
        images.push(image);
        view.add(image);
      }
      // Prefix widths include pair kerning with this character.
      image.setVisible(true).setTexture(atlas.key, frame).setScale(1 / resolution).setPosition(advance - glyph.left - left, -glyph.top - top);
    }
    for (const image of images.slice(count)) image.setVisible(false);
    return view;
  };
  view.setText = (text) => {
    content = String(text);
    view.text = content;
    return layout();
  };
  view.setLabelOrigin = (x = 0.5, y = 0.5) => { originX = x; originY = y; return layout(); };
  view.setLabelResolution = (resolution) => { atlas = atlasFor(scene, options, resolution); return layout(); };
  return view;
}
