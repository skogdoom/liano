import inventory from '../../art/packs/cartoon/inventory.json';
import review from '../../art/packs/cartoon/review/manifest.json';
import { layoutFor } from '../layout.js';
import { WORLD_HEIGHT } from '../config.js';
import { inventorySummary } from './cartoonInventory.js';

// Development-only samples. They deliberately do not enter the game catalog or
// claim to be finished joints, seamless tiles or collision-aligned production art.
const image = new Image();
image.src = `/art/packs/cartoon/${review.image}`;
await image.decode();
document.getElementById('sheet').src = image.src;
const samples = new Map(review.samples.map((s) => [s.id, s]));
const draw = (ctx, id, x, y, w, h) => {
  const sample = samples.get(id);
  const { x: sx, y: sy, w: sw, h: sh } = sample.source;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
};
const fitBounds = (id, x, y, w, h) => {
  const { source } = samples.get(id);
  const scale = Math.min(w / source.w, h / source.h);
  const sw = source.w * scale, sh = source.h * scale;
  return { x: x + (w - sw) / 2, y: y + (h - sh) / 2, w: sw, h: sh, scale };
};

for (const sample of review.samples) {
  const article = document.createElement('article');
  const title = document.createElement('h3');
  title.textContent = sample.title;
  const canvas = document.createElement('canvas');
  canvas.width = sample.source.w;
  canvas.height = sample.source.h;
  draw(canvas.getContext('2d'), sample.id, 0, 0, canvas.width, canvas.height);
  const caption = document.createElement('p');
  caption.textContent = sample.note;
  article.append(canvas, title, caption);
  document.getElementById('cards').append(article);
}

const choices = { desktop: [1280, 720], landscape: [812, 375], portrait: [375, 812] };
const canvas = document.getElementById('scene');
const render = () => {
  const [width, height] = choices[document.getElementById('viewport').value];
  const light = document.getElementById('light').value;
  const actual = document.getElementById('display').value === 'actual';
  const available = canvas.parentElement.clientWidth;
  const shown = actual ? width : Math.min(width, available);
  canvas.style.width = `${shown}px`;
  canvas.style.height = `${shown * height / width}px`;
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * density;
  canvas.height = height * density;
  const ctx = canvas.getContext('2d');
  ctx.scale(density, density);
  ctx.fillStyle = light === 'day' ? '#2c563e' : '#122b37';
  ctx.fillRect(0, 0, width, height);
  const layout = layoutFor(width, height);
  ctx.translate(layout.x, layout.y);
  ctx.scale(layout.scale, layout.scale);
  // Static scene composition; crop the same sample strip over the logical view.
  draw(ctx, light, 0, 0, layout.view.width, layout.view.height);
  ctx.translate(0, layout.bandTop);
  const hx = layout.view.width * .28, hy = WORLD_HEIGHT * .44;
  const fx = layout.view.width * .51, fy = WORLD_HEIGHT * .36;
  const h = review.classicRigBounds.hanging, f = review.classicRigBounds.flying;
  const hanging = fitBounds('hanging', hx + h.x, hy + h.y, h.w, h.h);
  const flying = fitBounds('flying', fx + f.x, fy + f.y, f.w, f.h);
  const source = samples.get('hanging').source;
  const gripX = hanging.x + (review.grip.x - source.x) * hanging.scale;
  const gripY = hanging.y + (review.grip.y - source.y) * hanging.scale;
  ctx.strokeStyle = light === 'day' ? '#639431' : '#537b50';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gripX - 16, 16); ctx.lineTo(gripX, gripY); ctx.stroke();
  draw(ctx, 'hanging', hanging.x, hanging.y, hanging.w, hanging.h);
  draw(ctx, 'flying', flying.x, flying.y, flying.w, flying.h);
  draw(ctx, 'branch', layout.view.width * .09, 540, 205, 92);
  draw(ctx, 'temple', layout.view.width * .61, 345, 330, 320);
  const visibleScale = layout.scale * shown / width;
  document.getElementById('scale').textContent = `${width} × ${height} CSS viewport · ${visibleScale.toFixed(2)} displayed CSS pixels per game unit${!actual && shown < width ? ' (choose Actual CSS size to inspect without fitting)' : ''}`;
};
for (const id of ['viewport', 'light', 'display']) document.getElementById(id).addEventListener('change', render);
new ResizeObserver(render).observe(canvas.parentElement);
render();

const summary = inventorySummary(inventory);
document.getElementById('coverage').textContent = `${inventory.pieceCount} pieces / ${inventory.frameCount} required frames. Production status: ${summary.totals.reviewed} reviewed, ${summary.totals.painted} painted, ${summary.totals.pending} pending. Style samples do not count as completed production frames.`;
for (const family of summary.families) {
  const row = document.createElement('tr');
  for (const value of [family.family, family.pieces, family.pending + family.painted + family.reviewed]) {
    const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
  }
  document.getElementById('families').append(row);
}
document.documentElement.dataset.cartoonReview = 'ready';
