import { PARITY, compareImages, solidPixels } from '../visualDiff.js';
import { ATLAS_SCALES, TILE_EDGE } from './catalog.js';
import { frameName } from './piece.js';
import { artChoice } from '../platform/artStyle.js';

// The art gallery (art.html, dev only): every piece and frame from the built atlases next
// to the game's drawing of it, the difference between them, the
// contract and the guides. Results on `window.__gallery` for the browser tests.
//
// What counts as identical (PHASER_PLAN.md, section 1) is for scenes. A small piece's cell
// is mostly antialiased edge, where rasterizers always differ a little, so the pieces are
// judged as if they covered a scene together: the share of differing pixels and the solid
// patches per million over all frames. A frame fails on its own if its solid patches
// alone would fail a scene: a 1280 × 720 view at the atlas's density (per million of its
// own few pixels, a single solid pixel would).
const SCENE_PIXELS = 1280 * 720;

const params = new URLSearchParams(location.search);
const pack = artChoice(location.search);
const base = `/art/${pack}/`;
const sourceRoot = pack === 'cartoon' ? '/art/packs/cartoon/' : '/art/';
const scale = ATLAS_SCALES.includes(Number(params.get('scale'))) ? Number(params.get('scale')) : 2;
const frameSolidLimit = (PARITY.solidPerMillion * SCENE_PIXELS * scale ** 2) / 1e6;
const guides = params.get('guides') !== 'off';
const only = params.get('piece');
const css = '#4a8060';

const controls = document.querySelector('.controls');
for (const id of ['classic', 'cartoon']) controls.insertAdjacentHTML('beforeend', `<a href="?art=${id}&scale=${scale}">${id}${id === pack ? ' (shown)' : ''}</a>`);
for (const s of ATLAS_SCALES) controls.insertAdjacentHTML('beforeend', `<a href="?art=${pack}&scale=${s}${guides ? '' : '&guides=off'}">${s}×${s === scale ? ' (shown)' : ''}</a>`);
controls.insertAdjacentHTML('beforeend', `<a href="?art=${pack}&scale=${scale}${guides ? '&guides=off' : ''}">guides ${guides ? 'off' : 'on'}</a>`);
controls.insertAdjacentHTML('beforeend', `<a href="/rigs.html?art=${pack}">assembled rigs</a>`);

const loadImage = async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
};
const loadJson = async (url) => (await fetch(url)).json();

// A canvas of w × h over the background, at `zoom` CSS px per px.
function canvasOf(w, h, zoom = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * zoom}px`;
  canvas.style.height = `${h * zoom}px`;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = css;
  context.fillRect(0, 0, w, h);
  return { canvas, context };
}

function figure(child, caption) {
  const el = document.createElement('figure');
  el.append(child, Object.assign(document.createElement('figcaption'), { textContent: caption }));
  return el;
}

// The guides over a picture of the piece at `zoom` px per unit.
function drawGuides(context, contract, zoom) {
  const { box } = contract;
  const px = (x, y) => [(x - box.x) * zoom, (y - box.y) * zoom];
  context.lineWidth = 1;
  context.strokeStyle = '#00b7ff';
  context.setLineDash([4, 3]);
  context.strokeRect(0.5, 0.5, box.w * zoom - 1, box.h * zoom - 1);
  context.setLineDash([]);
  const [ox, oy] = px(0, 0);
  context.strokeStyle = '#ff00ff';
  context.beginPath();
  context.moveTo(ox - 5, oy);
  context.lineTo(ox + 5, oy);
  context.moveTo(ox, oy - 5);
  context.lineTo(ox, oy + 5);
  context.stroke();
  context.strokeStyle = '#33dd33';
  for (const s of contract.hitbox ?? []) {
    context.beginPath();
    if (s.r !== undefined) context.arc(...px(s.dx, s.dy), s.r * zoom, 0, Math.PI * 2);
    else context.rect(...px(s.dx, s.dy), s.w * zoom, s.h * zoom);
    context.stroke();
  }
  context.strokeStyle = '#ff9900';
  for (const [x, y] of Object.values(contract.attach ?? {})) {
    context.beginPath();
    context.arc(...px(x, y), 3, 0, Math.PI * 2);
    context.stroke();
  }
}

// Rasterize the generated SVG at the exact cell size used by the atlas build.
// This keeps the artist's gallery independent of a game rendering library.
async function svgFrame(piece, i, box, w, h, zoom) {
  const source = await (await fetch(`${sourceRoot}${piece.frames[i]}`)).text();
  const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${w / zoom} ${h / zoom}`);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const image = await loadImage(url);
    const { canvas, context } = canvasOf(w, h);
    context.drawImage(image, 0, 0);
    return { canvas, data: context.getImageData(0, 0, w, h).data };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Blurs RGBA `data` (w × h) sideways, wrapping around as a repeating tile does, with a
// Gaussian of standard deviation `sigma` px, in premultiplied colour as SVG filters blur.
function blurSideways(data, w, h, sigma, wrap = true) {
  const radius = Math.ceil(3 * sigma);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, k) => Math.exp(-((k - radius) ** 2) / (2 * sigma * sigma)));
  const sum = kernel.reduce((a, b) => a + b, 0);
  const row = new Float32Array(w * 4);
  for (let y = 0; y < h; y++) {
    const o = y * w * 4;
    for (let x = 0; x < w; x++) {
      const a = data[o + 4 * x + 3] / 255;
      for (let c = 0; c < 3; c++) row[4 * x + c] = data[o + 4 * x + c] * a;
      row[4 * x + 3] = data[o + 4 * x + 3];
    }
    for (let x = 0; x < w; x++) {
      const out = [0, 0, 0, 0];
      for (let k = -radius; k <= radius; k++) {
        if (!wrap && (x + k < 0 || x + k >= w)) continue;
        const weight = kernel[k + radius] / sum;
        for (let c = 0; c < 4; c++) out[c] += row[(4 * (((x + k) % w + w) % w)) + c] * weight;
      }
      const alpha = out[3];
      for (let c = 0; c < 3; c++) data[o + 4 * x + c] = alpha > 0 ? Math.round(out[c] / (alpha / 255)) : 0;
      data[o + 4 * x + 3] = Math.round(alpha);
    }
  }
}

const [catalog, manifest] = await Promise.all([loadJson(`${base}pieces.json`), loadJson(`${base}manifest.json`)]);
const contracts = Object.fromEntries(manifest.pieces.map((p) => [p.key, p]));
const atlases = {};
for (const set of catalog.sets) {
  const json = await loadJson(`${base}${set}@${scale}x.json`);
  for (const texture of json.textures) {
    const image = await loadImage(`${base}${texture.image}`);
    for (const f of texture.frames) atlases[f.filename] = { image, frame: f.frame };
  }
}
const customs = new Set(Object.keys(await loadJson(`${base}custom.json`).catch(() => ({}))));

const results = [];
const list = document.getElementById('pieces');
for (const piece of manifest.pieces) {
  if (only && piece.key !== only) continue;
  const contract = contracts[piece.key];
  const info = catalog.pieces[piece.key];
  const at = info.at[scale];
  const section = document.createElement('section');
  section.innerHTML = `<h2>${piece.key}</h2><p class="purpose"></p><p class="meta"></p>`;
  section.querySelector('.purpose').textContent = contract.purpose;
  const meta = [
    contract.kind,
    `set ${contract.set}`,
    `box ${contract.box.w} × ${contract.box.h} at (${contract.box.x}, ${contract.box.y})`,
    `scale ${contract.scale}`,
    contract.tint ? 'tinted' : 'not tinted',
    contract.frames.length > 1 ? `${contract.frames.length} frames${contract.fps ? ` at ${contract.fps} fps` : ''}` : '',
    contract.attach ? `attach ${Object.keys(contract.attach).join(', ')}` : '',
    contract.length ? `length ${contract.length}` : '',
  ].filter(Boolean);
  section.querySelector('.meta').textContent = meta.join(' · ');
  const row = document.createElement('div');
  row.className = 'row';
  section.append(row);
  list.append(section);

  const view = contract.box.w * at.zoom > 900 ? 900 / (contract.box.w * at.zoom) : Math.min(4, 160 / Math.max(at.size[0], at.size[1]));
  const animationFrames = [];
  for (let i = 0; i < piece.frames.length; i++) {
    const name = frameName(piece, i);
    const [w, h] = piece.kind === 'tile' ? [at.size[0], at.size[1]] : at.size;
    // From the atlas (or the tile's own image).
    const built = canvasOf(w, h, view);
    if (piece.kind === 'tile') built.context.drawImage(await loadImage(`${base}${at.image}`), 0, TILE_EDGE, w, h, 0, 0, w, h);
    else {
      const { image, frame } = atlases[name];
      built.context.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, w, h);
    }
    const builtData = built.context.getImageData(0, 0, w, h).data;
    if (guides) drawGuides(built.context, contract, at.zoom);
    animationFrames.push(built.canvas);
    const drawn = await svgFrame(piece, i, contract.box, w, h, at.zoom);
    // A softened piece: the drawing blurred sideways as the build blurs it.
    if (contract.soften) {
      blurSideways(drawn.data, w, h, contract.soften * at.zoom, contract.kind === 'tile');
      drawn.canvas.getContext('2d').putImageData(new ImageData(drawn.data, w, h), 0, 0);
    }
    drawn.canvas.style.width = `${w * view}px`;
    const result = compareImages(drawn.data, builtData);
    const solid = solidPixels(result, w);
    const custom = customs.has(name);
    const pass = custom || solid <= frameSolidLimit;
    results.push({ key: piece.key, frame: i, name, custom, share: result.share, differing: result.differing, solid, pixels: result.pixels, pass });
    const diff = canvasOf(w, h, view);
    diff.context.putImageData(new ImageData(result.diff, w, h), 0, 0);
    const label = custom ? 'custom' : `${(result.share * 100).toFixed(2)} %, ${solid} solid`;
    row.append(
      figure(built.canvas, `${name}: built (${w} × ${h})`),
      figure(drawn.canvas, custom ? 'generated (replaced)' : 'drawn'),
      figure(diff.canvas, label),
    );
    row.lastChild.querySelector('figcaption').className = custom ? 'custom' : pass ? 'pass' : 'fail';
  }
  if (piece.frames.length > 1) {
    const preview = document.createElement('canvas'); preview.width = at.size[0]; preview.height = at.size[1];
    preview.style.width = `${preview.width * view}px`;
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = String(piece.frames.length - 1); slider.value = '0';
    slider.setAttribute('aria-label', `${piece.key} frame`);
    const play = document.createElement('button'); play.textContent = 'Animate frames';
    let playing = false, timer = null;
    const show = (frame) => { preview.getContext('2d').drawImage(animationFrames[frame], 0, 0); slider.value = String(frame); };
    slider.addEventListener('input', () => show(Number(slider.value)));
    play.addEventListener('click', () => {
      playing = !playing; play.textContent = playing ? 'Stop animation' : 'Animate frames';
      if (timer) clearInterval(timer);
      if (playing) { let tick = Number(slider.value); timer = setInterval(() => {
        const period = 2 * (piece.frames.length - 1), index = ++tick % period;
        show(index < piece.frames.length ? index : period - index);
      }, 1000 / (contract.fps ?? 30)); }
    });
    section.prepend(preview, slider, play); show(0);
  } else if (piece.kind === 'tile') {
    const seam = canvasOf(at.size[0] * 2, at.size[1], Math.min(view, 900 / (at.size[0] * 2)));
    seam.context.drawImage(animationFrames[0], 0, 0); seam.context.drawImage(animationFrames[0], at.size[0], 0);
    row.prepend(figure(seam.canvas, 'Two adjacent tiles: inspect the repeat seam'));
  }
}
const failed = results.filter((r) => !r.pass);
const generated = results.filter((r) => !r.custom);
const total = Math.max(1, generated.reduce((n, r) => n + r.pixels, 0));
const share = generated.reduce((n, r) => n + r.differing, 0) / total;
const solidPerMillion = (generated.reduce((n, r) => n + r.solid, 0) / total) * 1e6;
const sharePass = share < PARITY.share && solidPerMillion <= PARITY.solidPerMillion;
const summary = document.getElementById('summary');
summary.textContent =
  `${manifest.pieces.length} pieces, ${results.length} frames at ${scale}×: ${(share * 100).toFixed(2)} % of all their pixels differ (limit ${PARITY.share * 100} %), ` +
  `${solidPerMillion.toFixed(1)} solid per million (limit ${PARITY.solidPerMillion}); ` +
  (failed.length ? `${failed.length} frames with solid patches over ${frameSolidLimit.toFixed(0)} px: ${failed.map((r) => r.name).join(', ')}.` : `no frame with solid patches over ${frameSolidLimit.toFixed(0)} px.`);
summary.className = failed.length || !sharePass ? 'fail' : 'pass';
window.__gallery = { pack, scale, share, solidPerMillion, pass: sharePass && failed.length === 0, frames: results };
document.documentElement.dataset.gallery = 'done';
