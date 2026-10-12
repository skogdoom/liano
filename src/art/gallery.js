import { Application, Container, Graphics } from 'pixi.js';
import { PARITY, compareImages, solidPixels } from '../parity/diff.js';
import { ATLAS_SCALES } from './catalog.js';
import { frameName } from './piece.js';
import { PIECES } from './pieces/index.js';

// The art gallery (art.html, dev only): every piece and frame from the built atlases next
// to the game's drawing of it, the difference between them (as on the parity page), the
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
const scale = ATLAS_SCALES.includes(Number(params.get('scale'))) ? Number(params.get('scale')) : 2;
const frameSolidLimit = (PARITY.solidPerMillion * SCENE_PIXELS * scale ** 2) / 1e6;
const guides = params.get('guides') !== 'off';
const only = params.get('piece');
const BACKGROUND = 0x4a8060;
const css = '#4a8060';

const controls = document.querySelector('.controls');
for (const s of ATLAS_SCALES) controls.insertAdjacentHTML('beforeend', `<a href="?scale=${s}${guides ? '' : '&guides=off'}">${s}×${s === scale ? ' (shown)' : ''}</a>`);
controls.insertAdjacentHTML('beforeend', `<a href="?scale=${scale}${guides ? '&guides=off' : ''}">guides ${guides ? 'off' : 'on'}</a>`);

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

const app = new Application();
await app.init({ width: 64, height: 64, preference: 'webgl', antialias: true, resolution: 1, background: BACKGROUND, preserveDrawingBuffer: true, autoStart: false });

// A Graphics that draws everything `zoom` times larger. Pixi builds a drawing's triangles
// in its own units, so a container scaled up shows a small round end or join as the few
// corners it was built with; drawn at the final size, it is as round as in the atlas.
const SCALED_ARGS = { rect: 4, roundRect: 5, circle: 3, ellipse: 4, moveTo: 2, lineTo: 2, quadraticCurveTo: 4, bezierCurveTo: 6, arc: 3 };
function zoomed(g, zoom) {
  const proxy = new Proxy(g, {
    get(target, name) {
      const value = target[name];
      if (typeof value !== 'function') return value;
      return (...args) => {
        if (name in SCALED_ARGS) args = args.map((a, k) => (k < SCALED_ARGS[name] ? a * zoom : a));
        else if (name === 'poly') args = [args[0].map((a) => a * zoom), ...args.slice(1)];
        else if (name === 'stroke') {
          const style = typeof args[0] === 'number' ? { color: args[0] } : (args[0] ?? {});
          args = [{ ...style, width: (style.width ?? 1) * zoom }];
        }
        const result = value.apply(target, args);
        return result === target ? proxy : result;
      };
    },
  });
  return proxy;
}

// The game's drawing of one frame, in a w × h cell at `zoom` px per unit, the cell's
// corner at `box`'s.
function pixiFrame(piece, i, box, w, h, zoom) {
  app.renderer.resize(w, h);
  const world = new Container();
  const g = new Graphics();
  // A see-through piece: Pixi blends each shape on its own at the Graphics' alpha.
  g.alpha = piece.alpha ?? 1;
  piece.frames[i](zoomed(g, zoom));
  // Nothing to draw (a wing seen edge on): the renderer would leave the last picture.
  if (g.bounds.width === 0 || g.bounds.height === 0) {
    g.destroy();
    const blank = canvasOf(w, h);
    return { canvas: blank.canvas, data: blank.context.getImageData(0, 0, w, h).data };
  }
  world.addChild(g);
  world.position.set(-box.x * zoom, -box.y * zoom);
  app.stage.removeChildren();
  app.stage.addChild(world);
  app.render();
  const { canvas, context } = canvasOf(w, h);
  context.drawImage(app.canvas, 0, 0, w, h);
  world.destroy({ children: true });
  return { canvas, data: context.getImageData(0, 0, w, h).data };
}

const [catalog, manifest] = await Promise.all([loadJson('/art/pieces.json'), loadJson('/art/manifest.json')]);
const contracts = Object.fromEntries(manifest.pieces.map((p) => [p.key, p]));
const atlases = {};
for (const set of catalog.sets) {
  const json = await loadJson(`/art/${set}@${scale}x.json`);
  for (const texture of json.textures) {
    const image = await loadImage(`/art/${texture.image}`);
    for (const f of texture.frames) atlases[f.filename] = { image, frame: f.frame };
  }
}
const customs = new Set(Object.keys(await loadJson('/art/custom.json').catch(() => ({}))));

const results = [];
const list = document.getElementById('pieces');
for (const piece of PIECES) {
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
  for (let i = 0; i < piece.frames.length; i++) {
    const name = frameName(piece, i);
    const [w, h] = piece.kind === 'tile' ? [at.size[0], at.size[1]] : at.size;
    // From the atlas (or the tile's own image).
    const built = canvasOf(w, h, view);
    if (piece.kind === 'tile') built.context.drawImage(await loadImage(`/art/${info.image}`), 0, 0);
    else {
      const { image, frame } = atlases[name];
      built.context.drawImage(image, frame.x, frame.y, frame.w, frame.h, 0, 0, w, h);
    }
    const builtData = built.context.getImageData(0, 0, w, h).data;
    if (guides) drawGuides(built.context, contract, at.zoom);
    const drawn = pixiFrame(piece, i, contract.box, w, h, at.zoom);
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
}
const failed = results.filter((r) => !r.pass);
const generated = results.filter((r) => !r.custom);
const total = Math.max(1, generated.reduce((n, r) => n + r.pixels, 0));
const share = generated.reduce((n, r) => n + r.differing, 0) / total;
const solidPerMillion = (generated.reduce((n, r) => n + r.solid, 0) / total) * 1e6;
const sharePass = share < PARITY.share && solidPerMillion <= PARITY.solidPerMillion;
const summary = document.getElementById('summary');
summary.textContent =
  `${PIECES.length} pieces, ${results.length} frames at ${scale}×: ${(share * 100).toFixed(2)} % of all their pixels differ (limit ${PARITY.share * 100} %), ` +
  `${solidPerMillion.toFixed(1)} solid per million (limit ${PARITY.solidPerMillion}); ` +
  (failed.length ? `${failed.length} frames with solid patches over ${frameSolidLimit.toFixed(0)} px: ${failed.map((r) => r.name).join(', ')}.` : `no frame with solid patches over ${frameSolidLimit.toFixed(0)} px.`);
summary.className = failed.length || !sharePass ? 'fail' : 'pass';
window.__gallery = { scale, share, solidPerMillion, pass: sharePass && failed.length === 0, frames: results };
document.documentElement.dataset.gallery = 'done';
