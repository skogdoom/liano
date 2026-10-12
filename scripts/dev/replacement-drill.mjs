// The replacement drill (PHASER_PLAN.md, M4 and M7): swaps one piece of each kind for
// placeholder art in art/custom/, so a build shows them in the gallery (art.html) and on
// the rig pages (parity.html) with no code change. Then `npm run art:check` and
// `npm run art:build`, and look; `--revert` removes the placeholders again.
//
//   node scripts/dev/replacement-drill.mjs           write the placeholders
//   node scripts/dev/replacement-drill.mjs --bad     also a picture in the wrong aspect,
//                                                    for the validator to refuse
//   node scripts/dev/replacement-drill.mjs --revert  remove them
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('../../art/', import.meta.url);
const custom = new URL('custom/', root);
const { pieces } = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const byKey = Object.fromEntries(pieces.map((p) => [p.key, p]));

// One piece of each kind: [key, what kind, frames to replace ('all' or a list), as PNG?]
const DRILL = [
  ['branch.body', 'plain', 'all', false],
  ['panther.tail', 'flipbook', 'all', false],
  ['monkey.p1.arm', 'joint (turns about its pivot)', 'all', false],
  ['branch.trunk', 'stretch', 'all', false],
  ['liana.green.rope', 'rope (strip)', 'all', false],
  ['backdrop.far', 'tinted tile', 'all', true],
];
const SIDECARS = { 'monkey.p1.arm.json': { pivot: [0, 0] } };

const files = [];
for (const [key, , , png] of DRILL) {
  const piece = byKey[key];
  piece.frames.forEach((_, i) => files.push({ piece, i, name: `${piece.frames.length === 1 ? key : `${key}.${i}`}.${png ? 'png' : 'svg'}` }));
}

if (process.argv.includes('--revert')) {
  for (const name of [...files.map((f) => f.name), ...Object.keys(SIDECARS), 'rock.ledge.svg']) rmSync(new URL(name, custom), { force: true });
  console.log('art/custom: drill placeholders removed');
  process.exit(0);
}

// A placeholder: the box in a loud colour, crossed, with the frame number, and a dot on
// the origin, so it is plain where the game put it and about which point.
function placeholder({ piece, i }) {
  const { x, y, w, h } = piece.box;
  const s = Math.min(w, h);
  const hue = (i * 47) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="hsl(${hue} 90% 55%)" fill-opacity="0.85"/>
<path d="M${x} ${y} L${x + w} ${y + h} M${x + w} ${y} L${x} ${y + h}" stroke="#111" stroke-width="${Math.max(s * 0.04, 0.5)}"/>
<circle cx="0" cy="0" r="${Math.max(s * 0.08, 1)}" fill="#fff"/>
<text x="${x + w / 2}" y="${y + h / 2}" font-size="${s * 0.4}" text-anchor="middle" dominant-baseline="middle" fill="#111">${i}</text>
</svg>`;
}

mkdirSync(custom, { recursive: true });
for (const f of files) {
  const svg = placeholder(f);
  const data = f.name.endsWith('.png') ? new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 } }).render().asPng() : svg;
  writeFileSync(new URL(f.name, custom), data);
}
for (const [name, sidecar] of Object.entries(SIDECARS)) writeFileSync(new URL(name, custom), JSON.stringify(sidecar));
if (process.argv.includes('--bad')) writeFileSync(new URL('rock.ledge.svg', custom), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 40"/>');
console.log(
  `art/custom: ${files.length} placeholder frames for ${DRILL.map(([key, kind]) => `${key} (${kind})`).join(', ')}` +
    (existsSync(new URL('rock.ledge.svg', custom)) ? '; rock.ledge.svg in the wrong aspect' : ''),
);
