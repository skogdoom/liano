import { Application, Graphics } from 'pixi.js';
import { SPIKE_PIECES } from '../art/spike.js';
import manifest from '../../art/manifest.json';
import { compareImages, passes } from '../parity/diff.js';

// M1 spike (dev only, spike/compare.html): draws every piece frame with Pixi (the
// reference: what the game draws today) and compares it with its generated SVG
// rasterized by Chromium and by resvg. Results on `window.__compare`.

const BACKGROUND = 0x4a8060;
const css = `#${BACKGROUND.toString(16).padStart(6, '0')}`;

const loadImage = async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
};

// RGBA pixels of `source` drawn at w × h over the background.
function pixels(source, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = css;
  context.fillRect(0, 0, w, h);
  context.drawImage(source, 0, 0, w, h);
  return context.getImageData(0, 0, w, h).data;
}

const app = new Application();
await app.init({ width: 16, height: 16, preference: 'webgl', antialias: true, resolution: 1, background: BACKGROUND, preserveDrawingBuffer: true, autoStart: false });

function drawWithPixi(draw, box, zoom, w, h) {
  app.renderer.resize(w, h);
  const g = draw(new Graphics());
  g.scale.set(zoom);
  g.position.set(-box.x * zoom, -box.y * zoom);
  app.stage.addChild(g);
  app.render();
  const result = pixels(app.canvas, w, h);
  g.destroy();
  return result;
}

// `?show=panther.eyes.0@2,liana.leaf.0@1` shows those pieces magnified: Pixi, resvg and
// their differences, pixel for pixel.
const show = new Set((new URLSearchParams(location.search).get('show') ?? '').split(',').filter(Boolean));
function magnified(caption, data, w, h, zoom = Math.max(1, Math.min(10, Math.floor(360 / w)))) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  canvas.style.cssText = `width:${w * zoom}px;image-rendering:pixelated;display:block`;
  const figure = document.createElement('figure');
  figure.style.cssText = 'display:inline-block;margin:8px';
  figure.append(canvas, Object.assign(document.createElement('figcaption'), { textContent: caption }));
  document.body.append(figure);
}

const results = [];
const table = document.getElementById('results');
const cell = (share) => `<td class="${share < 0.01 ? 'pass' : 'fail'}">${(share * 100).toFixed(2)} %</td>`;
for (const piece of SPIKE_PIECES) {
  const entry = manifest.pieces.find((p) => p.key === piece.key);
  for (let i = 0; i < piece.frames.length; i++) {
    const file = entry.frames[i];
    const name = file.replace('generated/', '').replace(/\.svg$/, '');
    for (const atlasScale of [1, 2]) {
      const zoom = atlasScale * piece.scale;
      const resvg = await loadImage(`/art/build/resvg/${name}@${atlasScale}x.png`);
      const w = resvg.naturalWidth;
      const h = resvg.naturalHeight;
      const pixi = drawWithPixi(piece.frames[i], entry.box, zoom, w, h);
      const chromium = pixels(await loadImage(`/art/${file}`), w, h);
      const fromResvg = pixels(resvg, w, h);
      const row = {
        name,
        atlasScale,
        w,
        h,
        chromium: compareImages(pixi, chromium).share,
        resvg: compareImages(pixi, fromResvg).share,
        between: compareImages(chromium, fromResvg).share,
      };
      // What a 1× bake costs on a 2× screen: resvg's 1× picture stretched to 2×, against
      // Pixi drawing at 2×.
      if (atlasScale === 2) {
        const oneX = await loadImage(`/art/build/resvg/${name}@1x.png`);
        row.upscaled = compareImages(pixi, pixels(oneX, w, h)).share;
      }
      results.push(row);
      if (show.has(`${name}@${atlasScale}`)) {
        magnified(`${name}@${atlasScale}: Pixi`, pixi, w, h);
        magnified('resvg', fromResvg, w, h);
        magnified('differences (red: over 8/255)', compareImages(pixi, fromResvg).diff, w, h);
      }
      table.insertAdjacentHTML(
        'beforeend',
        `<tr><td>${name} @${atlasScale}×</td><td>${w} × ${h}</td>${cell(row.chromium)}${cell(row.resvg)}${cell(row.between)}${row.upscaled === undefined ? '<td></td>' : cell(row.upscaled)}</tr>`,
      );
    }
  }
}
const weighted = (key) => results.reduce((s, r) => s + r[key] * r.w * r.h, 0) / results.reduce((s, r) => s + r.w * r.h, 0);
const failing = (key) => results.filter((r) => !passes({ share: r[key] })).length;
document.getElementById('summary').textContent =
  `Over all ${results.length}: Chromium ${(weighted('chromium') * 100).toFixed(2)} % (${failing('chromium')} over the limit), ` +
  `resvg ${(weighted('resvg') * 100).toFixed(2)} % (${failing('resvg')} over the limit), pixel-weighted.`;
window.__compare = results;
document.documentElement.dataset.compare = 'done';
