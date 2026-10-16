// Deterministic sprite exports from painted component masters and editable
// vector recipes. Never reads classic drawings; only their placement contracts.
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { guideLayer } from '../src/art/svg.js';
import { frameName } from '../src/art/piece.js';
import { cartoonInventory } from '../src/art/cartoonInventory.js';
import { OBSTACLE_HITBOXES } from '../src/config.js';
import { imageSize } from '../src/art/custom.js';
import { packAlpha, packFrameCount } from '../src/art/packs.js';
import { registerLimb, registerTriangle } from '../src/art/registration.js';
import { ARM, LEG } from '../src/views/monkey.js';
import { TEMPLE_BRAZIERS } from '../src/views/obstacles.js';

// The hanging decoration shares the painted player limbs, with its own fur.
// Match this baked multiplier with the runtime tint on those reused leg images.
const hangingMonkeyTint = 0xffd0c8;
const forestFloorColor = '#111c18';

const root = new URL('../art/packs/cartoon/', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url)));
const layout = JSON.parse(readFileSync(new URL('source-layout.json', root)));
mkdirSync(new URL('components/', root), { recursive: true });
mkdirSync(new URL('generated/', root), { recursive: true });
const uri = (data) => `data:image/png;base64,${data.toString('base64')}`;
const document = (body, { x = 0, y = 0, w, h }) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${body}</svg>`;
const pictures = new Map();
for (const [key, { source, cell }] of Object.entries(layout.components)) {
  const bytes = readFileSync(new URL(source, root));
  const size = imageSize(source, bytes);
  if (!size || ![cell.x, cell.y, cell.w, cell.h].every(Number.isFinite) || cell.x < 0 || cell.y < 0 || cell.w <= 0 || cell.h <= 0 || cell.x + cell.w > size.width || cell.y + cell.h > size.height) throw new Error(`Invalid source crop: ${key}`);
  const data = uri(bytes);
  const picture = `<image width="${size.width}" height="${size.height}" href="${data}"/>`;
  const preview = new Resvg(document(picture, cell)).render();
  const { pixels, width, height } = preview;
  let [x0, y0, x1, y1] = [width, height, 0, 0];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] < 24) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  if (x0 >= x1 || y0 >= y1) throw new Error(`Empty painted component: ${key}`);
  const box = { x: cell.x + x0, y: cell.y + y0, w: x1 - x0, h: y1 - y0 };
  const maxWidth = layout.components[key].maxWidth;
  if (maxWidth !== undefined && (!Number.isInteger(maxWidth) || maxWidth < 1)) throw new Error(`Invalid export width: ${key}`);
  const exported = new Resvg(document(picture, box), maxWidth && maxWidth < box.w ? { fitTo: { mode: 'width', value: maxWidth } } : {}).render();
  const cropped = exported.asPng();
  writeFileSync(new URL(`components/${key}.png`, root), cropped);
  const landmarks = layout.components[key].landmarks ?? {};
  if (Object.values(landmarks).some((point) => !Array.isArray(point) || point.length !== 2 || point.some((v) => !Number.isFinite(v) || v < 0 || v > 1))) throw new Error(`Invalid landmarks: ${key}`);
  // Boundary samples fit a whole wing cycle inside its atlas cell and place
  // stone contacts against the actual painted silhouette.
  const outline = [];
  const samples = key.endsWith('-wing') || key.startsWith('rock-') || key === 'wood-platform' ? exported.pixels : null;
  if (samples) for (let y = 0; y < exported.height; y++) {
    let left = exported.width, right = -1;
    for (let x = 0; x < exported.width; x++) if (samples[(y * exported.width + x) * 4 + 3] >= 24) {
      left = Math.min(left, x); right = x;
    }
    if (right >= 0) outline.push([left, y], [right + 1, y + 1]);
  }
  const top = [];
  if (key === 'wood-platform') for (let x = 0; x < exported.width; x++) {
    let y = 0;
    while (y < exported.height && samples[(y * exported.width + x) * 4 + 3] < 128) y++;
    top.push(y);
  }
  pictures.set(key, { uri: uri(cropped), w: exported.width, h: exported.height, outline, top,
    landmarks: Object.fromEntries(Object.entries(landmarks).map(([name, point]) => [name, [point[0] * exported.width, point[1] * exported.height]])) });
}

const n = (v) => Math.round(v * 1000) / 1000;
const rockNames = ['sandstone', 'slate', 'ochre', 'granite', 'moss', 'limestone'];
// Keep each painted silhouette's proportions within the shared collision guide.
const rockPlacement = (frame) => {
  const key = `rock-${rockNames[frame]}`, pic = pictures.get(key);
  const scale = Math.min(64 / pic.w, 60 / pic.h);
  return { key, pic, scale, x: -pic.w * scale / 2, y: -pic.h * scale / 2 };
};
const rockOutline = (frame) => {
  const { pic, scale, x, y } = rockPlacement(frame);
  return pic.outline.map(([px, py]) => [px * scale + x, py * scale + y]);
};
const platformTopAt = (x) => {
  const pic = pictures.get('wood-platform');
  const { box } = baseline.pieces.find(p => p.key === 'rock.ledge');
  const column = Math.floor((x - box.x - 1) * pic.w / (box.w - 2));
  if (column < 0 || column >= pic.w || pic.top[column] === pic.h) return Infinity;
  return box.y + 1 + pic.top[column] * (box.h - 2) / pic.h;
};
const hangingTorsoMatrix = () => {
  const { landmarks } = pictures.get('monkey-torso');
  return registerTriangle([landmarks.armBack, landmarks.armFront, landmarks.hip], [[-7, 25], [7, 25], [0, 41]]);
};
const registeredPoint = ([a, b, c, d, e, f], [x, y]) => [a * x + c * y + e, b * x + d * y + f];
const playerTorsoMatrix = (piece) => {
  const { landmarks } = pictures.get('monkey-torso');
  const hip = piece.attach.legBack.map((v, i) => (v + piece.attach.legFront[i]) / 2);
  return registerTriangle([landmarks.armBack, landmarks.armFront, landmarks.hip], [piece.attach.armBack, piece.attach.armFront, hip]);
};
// Share each painted head's placement with its animated eye overlay.
const playerHeadMatrix = () => {
  const head = pictures.get('monkey-head');
  const { x, y, h } = baseline.pieces.find(p => p.key === 'monkey.p1.head').box;
  return [28 / head.w, 0, 0, (h - 2) / head.h, x + 1, y + 1];
};
const hangingHeadMatrix = () => {
  const head = pictures.get('hanging-monkey-head');
  return [22 / head.w, 0, 0, 18.8 / head.h, -11, 10.4];
};
const path = (d, fill = 'url(#paint)', stroke = '#243126', width = 0.8, extra = '') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const ellipse = (x, y, rx, ry, fill = 'url(#paint)', extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, fill = 'url(#paint)', extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const line = (d, color = '#526e31', width = 1, extra = '') => path(d, 'none', color, width, extra);
let paintBox;
// Explicit coordinates avoid browser/resvg differences in curved-path bounds.
const gradient = (id, colors, radial = false) => `<${radial ? 'radial' : 'linear'}Gradient id="${id}" ${radial ? '' : `gradientUnits="userSpaceOnUse" x1="${paintBox.x}" y1="${paintBox.y}" x2="${paintBox.x + paintBox.w}" y2="${paintBox.y + paintBox.h}"`}>${colors.map((c, i) => `<stop offset="${i / (colors.length - 1)}" stop-color="${c}"/>`).join('')}</${radial ? 'radial' : 'linear'}Gradient>`;
const palettes = {
  green: ['#a6cf55', '#589b3d', '#254e2c'], brown: ['#cc9654', '#93562d', '#4c2d22'],
  red: ['#ffb352', '#df5143', '#823042'], blue: ['#d5f4e8', '#68bdd7', '#315477'],
  purple: ['#c19dde', '#805aab', '#423458'], grey: ['#b0babc', '#788688', '#3c494e'],
  black: ['#657277', '#303b42', '#172429'], gold: ['#ffe8a0', '#e7ac41', '#94632c'],
};
const defs = (colors = palettes.green) => `<defs>${gradient('paint', colors)}${gradient('skin', ['#fff0be', '#efb270', '#cb8050'])}${gradient('shine', ['#f9fbdb', '#a5c05e', '#397146'])}${gradient('glow', ['#fff2af', '#eead3b', '#ff6f28'], true)}</defs>`;
const picture = (key, box, margin = 1) => {
  const p = pictures.get(key);
  if (!p) throw new Error(`Missing painted component ${key}`);
  return `<use href="#picture-${key}" transform="translate(${box.x + margin} ${box.y + margin}) scale(${(box.w - 2 * margin) / p.w} ${(box.h - 2 * margin) / p.h})"/>`;
};
// A straight shaft keeps the old support's approximate width without its root flare.
const pillar = box => picture('wood-pillar', { ...box, x: box.x + box.w / 4, w: box.w / 2 }, 0);
// Filters are baked into the exported images, never applied during gameplay.
const colorMatrix = (content, id, matrix, box) => `<defs><filter id="${id}"${box ? ` filterUnits="userSpaceOnUse" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"` : ''} color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrix}"/></filter></defs><g filter="url(#${id})">${content}</g>`;
const colorize = (content, look, box) => {
  if (!look || look === 'p1' || look === 'red' || look === 'purple') return content;
  const matrix = look === 'p2' ? '1.05 0 0 0 .1 0 1.15 0 0 .06 0 0 .9 0 .04 0 0 0 1 0'
    : look === 'russet' ? '1 0 0 0 0 0 .815686 0 0 0 0 0 .784314 0 0 0 0 0 1 0'
    : look === 'blue' ? '.15 .1 .3 0 0 .55 .55 .3 0 0 .95 .3 .65 0 0 0 0 0 1 0'
    : look === 'brown' ? '.65 .3 0 0 .05 .12 .58 0 0 .03 .1 .1 .3 0 .02 0 0 0 1 0'
    : look === 'green' ? '.22 .2 0 0 0 .3 .44 0 0 .02 .2 .36 .15 0 .04 0 0 0 1 0'
    : look === 'black' ? '.13 .2 .1 0 0 .15 .22 .12 0 0 .15 .25 .2 0 0 0 0 0 1 0'
    : '.25 .5 .25 0 0 .25 .5 .25 0 0 .25 .5 .25 0 0 0 0 0 1 0';
  return colorMatrix(content, 'palette', matrix, box);
};
const leaf = (length, halfWidth, fill = 'url(#paint)') => path(`M0 0 Q${length * .3} ${-halfWidth * 1.7} ${length} 0 Q${length * .4} ${halfWidth * 1.6} 0 0Z`, fill) + line(`M0 0 Q${length * .5} -1 ${length * .91} 0`, '#c6d66f', .45);
const roundStrip = (p, colors) => defs(colors) + rect(0, -p.box.h * .36, p.length ?? 20, p.box.h * .72, 'url(#paint)', `rx="${p.box.h * .36}"`) + line(`M0 ${-p.box.h * .13} H${p.length ?? 20}`, colors[0], Math.min(.7, p.box.h * .15));
const lianaGreen = ['#dce99a', '#a4c859', '#61883c'];
const spiderLeg = ['#e0cde5', '#ab8caf', '#68546f'];
const batPalettes = {
  purple: ['#e7c9ee', '#b58bc5', '#655175'], brown: ['#ecd6bb', '#b5977f', '#66504b'],
  grey: ['#e5e4e0', '#acaeb3', '#676e7d'], black: ['#c4c4d4', '#828397', '#44465d'],
};
const greenRope = (p, colors = lianaGreen) => {
  const halfWidth = p.box.h * .36, length = p.length;
  const rim = Math.min(1, p.box.h * .2), highlight = Math.min(1, p.box.h * .18);
  // Shade across the rope, rather than fading its lower end into the jungle.
  // The rim stays within the original box and leaves the rig/contact unchanged.
  return `<defs><linearGradient id="rope" gradientUnits="userSpaceOnUse" x1="0" y1="${-halfWidth}" x2="0" y2="${halfWidth}">${colors.map((c, i) => `<stop offset="${i / 2}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`
    + rect(0, -halfWidth, length, halfWidth * 2, 'url(#rope)', `rx="${halfWidth}" stroke="#293f28" stroke-width="${rim}"`)
    + line(`M2 ${-halfWidth * .45} H${length - 2}`, colors[0], highlight);
};
const eyePair = (closed, xs = [-3.5, 3.5], y = -11) => xs.map((x) => closed
  ? line(`M${x - 2} ${y - .5} Q${x} ${y + 1.5} ${x + 2} ${y - .5}`, '#33251e', 1.3)
  : ellipse(x, y, 2.7, 3.5, '#fff4db') + ellipse(x + .7, y + .3, 1.45, 2.1, '#40271d') + ellipse(x + 1, y - .7, .55, .7, '#ffffff')).join('');

// Geometry is measured in the trimmed painted head, then transformed with the
// head itself. Keeping the original whites avoids drawing new eyes over the fur.
const monkeyEyes = (frame, blink = false, key = 'monkey-head') => {
  const head = pictures.get(key);
  return Object.entries(layout.components[key].eyeSockets).map(([name, { rx: u, ry: v, angle }]) => {
    const [x, y] = head.landmarks[name], rx = u * head.w, ry = v * head.h;
    const drawing = frame ? blink
      ? colorize(ellipse(0, 0, rx, ry, '#f2b178') + line(`M${-rx + 2} 0 Q0 ${ry * .4} ${rx - 2} 0`, '#532b1c', 5), 'russet')
      : line(`M${-rx * .48} ${-ry * .46} L${rx * .48} ${ry * .46} M${rx * .48} ${-ry * .46} L${-rx * .48} ${ry * .46}`, '#33251e', 5)
      : ellipse(rx * .08, ry * .05, rx * .62, ry * .73, '#694123')
        + ellipse(rx * .12, ry * .08, rx * .40, ry * .57, '#241c15')
        + ellipse(rx * .22, -ry * .27, rx * .19, ry * .19, '#fff8e5');
    return `<g transform="translate(${x} ${y}) rotate(${angle})">${drawing}</g>`;
  }).join('');
};

function monkey(p, frame) {
  const [, who, part] = p.key.split('.');
  if (who === 'eyes' || part === 'eyes') return `<g transform="matrix(${playerHeadMatrix().join(' ')})">${monkeyEyes(frame)}</g>`;
  if (part === 'head') return colorize(`<use href="#picture-monkey-head" transform="matrix(${playerHeadMatrix().join(' ')})"/>`, who);
  const box = part === 'arm' ? { x: -6, y: -9, w: 12, h: 39 }
    : part === 'leg' ? { x: -6.5, y: -9, w: 13, h: 27 } : { ...p.box };
  if (part === 'arm' || part === 'leg') {
    const { landmarks } = pictures.get(`monkey-${part}`);
    const matrix = registerLimb(landmarks.joint, landmarks.tip, part === 'arm' ? ARM.length : LEG.length);
    return colorize(`<use href="#picture-monkey-${part}" transform="matrix(${matrix.join(' ')})"/>`, who);
  }
  if (part === 'torso') {
    const matrix = playerTorsoMatrix(p);
    return colorize(`<use href="#picture-monkey-torso" transform="matrix(${matrix.join(' ')})"/>`, who);
  }
  if (part === 'tail') {
    const tail = pictures.get('monkey-tail');
    const torso = baseline.pieces.find(piece => piece.key === `monkey.${who}.torso`);
    const target = registeredPoint(playerTorsoMatrix(torso), pictures.get('monkey-torso').landmarks.tailRoot);
    // Preserve the curl's size, but bury its painted cut end in the rear hip.
    // A fitted rectangle alone left the tail socket outside the torso silhouette.
    const sx = 33 / tail.w, sy = 34 / tail.h;
    const matrix = [sx, 0, 0, sy, target[0] - sx * tail.landmarks.root[0], target[1] - sy * tail.landmarks.root[1]];
    return colorize(`<use href="#picture-monkey-tail" transform="matrix(${matrix.join(' ')})"/>`, who);
  }
  return colorize(picture(`monkey-${part}`, box), who);
}

function scenery(p) {
  const { x, y, w, h } = p.box;
  const part = p.key.split('.')[1];
  if (part === 'sky') return defs(['#6cbed0', '#b9dbe0', '#dfecd3']) + rect(x, y, w, h);
  if (part === 'floorFill') return rect(x, y, w, h, forestFloorColor);
  const wrap = (body) => [-2048, 0, 2048].map((dx) => `<g transform="translate(${dx} 0)">${body}</g>`).join('');
  let body = '';
  if (part === 'far') {
    // Reflected halves make the exported tile mathematically continuous even
    // when a painted master has slightly different left/right edge colors.
    const landscape = picture('far-jungle', { x: 0, y: -60, w: 1024, h: 730 }, 0);
    // Atmospheric color/contrast compression separates painted scenery from
    // interactive vines, without changing the existing day/night runtime tints.
    // Waterfalls are separate landmarks, so reflecting the forest doesn't also
    // duplicate them: one large and one small fall per complete 2048-unit tile.
    const falls = picture('waterfall-big', { x: 210, y: 140, w: 150, h: 300 }, 0)
      + picture('waterfall-small', { x: 1470, y: 280, w: 85, h: 175 }, 0);
    body += colorMatrix(landscape + `<g transform="translate(2048 0) scale(-1 1)">${landscape}</g>` + falls, 'distance',
      '.616 .213 .021 0 .071 .063 .766 .021 0 .084 .063 .213 .574 0 .088 0 0 0 1 0');
  } else if (part === 'mid') {
    const tones = [
      '.22 .20 0 0 .035 .27 .40 0 0 .045 .23 .34 .15 0 .065',
      '.25 .23 0 0 .045 .28 .42 0 0 .050 .19 .29 .14 0 .055',
      '.18 .20 0 0 .030 .26 .38 0 0 .045 .25 .37 .16 0 .070',
    ];
    // A fixed, irregular grove repeats at the same 2048-unit period. Lean is
    // rooted at the floor; mirrored trunks vary the painted bark/branch shapes.
    const trees = [
      [45, -510, 112, -2, 0, false], [292, -300, 156, 3, 1, true],
      [588, -470, 91, -4, 2, false], [850, -150, 138, 2, 0, true],
      [1140, -390, 176, -3, 1, false], [1438, -540, 106, 4, 2, true],
      [1718, -220, 148, -2, 1, true], [1932, -410, 84, 3, 0, false],
    ];
    for (const [i, [tx, ty, width, lean, tone, flip]] of trees.entries()) {
      const wood = picture('trunk', { x: -width / 2, y: ty - 674, w: width, h: 674 - ty }, 0);
      const crownWidth = width * 2.8, crownHeight = 210 + i % 3 * 35;
      const crown = picture('canopy', { x: -crownWidth / 2, y: ty - 674 - crownHeight / 2, w: crownWidth, h: crownHeight }, 0);
      const tree = `<g transform="translate(${tx} 674) rotate(${lean}) scale(${flip ? -1 : 1} 1)">${wood + crown}</g>`;
      body += colorMatrix(tree, `tree-${i}`, `${tones[tone]} 0 0 0 1 0`);
    }
  } else {
    const top = part === 'nearTop' || part === 'canopy';
    const floor = part === 'floor';
    if (part === 'canopy') body += rect(0, -18, 2048, 48, '#1c5035');
    if (floor) body += rect(0, 657, 2048, 43, forestFloorColor);
    const count = floor ? 24 : 16;
    for (let i = 0; i < count; i++) {
      const sx = i * 2048 / count, sy = top ? y + (part === 'canopy' ? 16 : -32) : y + h - (floor ? 11 : 0);
      const pw = floor ? 134 : 188, ph = floor ? 62 : top ? 94 : 115;
      const shape = picture(top ? 'canopy' : 'fern', { x: sx - pw / 2, y: top ? sy : sy - ph, w: pw, h: ph }, 0);
      body += floor ? `<g opacity=".8">${colorize(shape, 'black')}</g>` : shape;
    }
    // Fade the painted frond roots into the same shadow color as the extended
    // floor. Bake this into the tile so tall views have no hard teal boundary.
    if (floor) body += `<defs><linearGradient id="forest-ground" gradientUnits="userSpaceOnUse" x1="0" y1="652" x2="0" y2="689"><stop stop-color="${forestFloorColor}" stop-opacity="0"/><stop offset="1" stop-color="${forestFloorColor}"/></linearGradient></defs>`
      + rect(0, 652, 2048, 48, 'url(#forest-ground)');
  }
  return wrap(body);
}

function temple(p, frame) {
  const [, look, part] = p.key.split('.');
  const foliage = (length, halfWidth) => {
    const source = pictures.get('leaf');
    const matrix = registerLimb([source.w * .02, source.h * .62], [source.w * .99, source.h * .76], 84);
    return `<g transform="scale(${length / 86} ${halfWidth / 21 * .85}) rotate(-90)"><use href="#picture-leaf" transform="matrix(${matrix.join(' ')})"/></g>`;
  };
  if (!part) {
    if (look === 'leaf') {
      const tones = [.62, .77, .71, .9, .8, 1, .72, .87];
      const tone = tones[frame];
      return colorMatrix(foliage(86, 21), 'temple-foliage', `${tone} 0 0 0 0 0 ${Math.min(1, tone + .08)} 0 0 0 0 0 ${tone} 0 0 0 0 0 1 0`);
    }
    if (look === 'moss') return defs(frame ? ['#a6c85d', '#6d9947', '#437146'] : ['#648a40', '#376434', '#254b35']) + path('M-22 0 Q-20 -7 -10 -3 Q-5 -8 3 -3 Q12 -8 22 0 Q18 5 7 3 Q0 8 -10 4Q-20 6 -22 0Z', 'url(#paint)', 'none');
    if (look === 'vine') return roundStrip(p, palettes.green);
    if (look === 'haze') return `<defs><radialGradient id="mist"><stop stop-color="#5b8470" stop-opacity=".18"/><stop offset="1" stop-color="#416452" stop-opacity="0"/></radialGradient></defs>${ellipse(0, 0, 330, 280, 'url(#mist)')}`;
    // The rig builds the soft falloff from translucent concentric layers, as
    // classic does. Fading the source too would attenuate the light twice.
    if (look === 'glow') return ellipse(0, 0, 73, 73, '#ff9234');
    if (look === 'flame') {
      const base = OBSTACLE_HITBOXES.temple[1].dy - 16;
      const sway = Math.floor(frame / 7) - 3, height = frame % 7 * 1.5, top = base - 19 - height;
      return defs(palettes.gold) + path(`M-6 ${base} Q-10 ${base - 12} ${sway} ${top} Q${sway + 7} ${base - 13} 6 ${base}Z`, '#f6a036', '#d97024', .6) + path(`M-3 ${base} Q-5 ${base - 7} ${sway} ${top + 8} Q5 ${base - 4} 3 ${base}Z`, '#fff3b0', 'none');
    }
    throw new Error(`Unpainted temple component ${p.key}`);
  }
  const colors = { limestone: ['#f4d99a', '#ba9b66', '#716446'], sandstone: ['#ffd295', '#c98b57', '#795038'], mossy: ['#b4c194', '#71876a', '#3a5346'], basalt: ['#adb3b4', '#64717c', '#35434f'] }[look];
  const block = (x, y, w, h) => path(`M${x} ${y} H${x + w} V${y + h} H${x}Z`, 'url(#paint)', colors[2], 1.3)
    + rect(x + 1, y + 1, w - 2, 4, colors[0])
    + Array.from({ length: Math.floor(w / 34) }, (_, i) => line(`M${x + i * 34 + 17} ${y + 5} V${y + h - 1}`, colors[2], 1.1, 'opacity=".45"')).join('');
  const courses = (x, y, w, h) => Array.from({ length: Math.ceil(h / 23) }, (_, i) => block(x, y + i * 23, w, Math.min(23, h - i * 23))).join('');
  const spiral = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${line('M-8 8V-8H8V8H-2V-1H2', colors[2], 2.7)}${line('M-7 9V-7H9', colors[0], .7)}</g>`;
  let body = defs(colors);
  if (part === 'top') {
    for (const r of [...OBSTACLE_HITBOXES.temple.slice(0, 4)].reverse()) body += courses(r.dx, r.dy, r.w, r.h);
    body += path('M-24 64V23L-16 14H16L24 23V64Z', colors[2], colors[0], 2);
    body += block(-54, 0, 108, 8);
    for (const y of [64, 110, 156]) for (const x of [-1, 1]) body += spiral(x * (y * .68 + 10), y + 24, .7);
    if (look === 'sandstone') body += block(-39, 8, 78, 8);
    if (look === 'basalt') for (const x of TEMPLE_BRAZIERS) {
      const base = OBSTACLE_HITBOXES.temple[1].dy - 16;
      body += path(`M${x - 10} ${base} H${x + 10} L${x + 5} ${base + 10} H${x - 5}Z`, '#9f7136', '#4c3b30', 1)
        + rect(x - 12, base - 1, 24, 3, '#e8bf6b', 'rx="1"')
        + rect(x - 3, base + 10, 6, 6, '#bd934e');
    }
    for (let y = 64; y < 202; y += 12) body += block(-30, y, 60, 12);
    for (const side of [-1, 1]) body += `<g transform="translate(${side * 46} 10) rotate(${side < 0 ? 132 : 48})">${foliage(44, 9)}</g>`;
  } else if (part === 'stairs') {
    body += rect(-38, 0, 76, 96, colors[2]);
    for (let y = 0; y < 96; y += 12) body += block(-30, y, 60, 12);
    for (const x of [-38, 31]) body += rect(x, 0, 7, 96, colors[1]);
  } else if (part === 'base' || part === 'baseTop') {
    const y = p.box.y;
    body += courses(-236, y, 472, 92);
    for (const x of [-191, -132, -73, 73, 132, 191]) body += path(`M${x - 24} ${y + 24}h48v54h-48Z`, colors[1], colors[2], 2) + spiral(x, y + 50, 1.1);
  } else throw new Error(`Unpainted temple ${p.key}`);
  return body;
}

const flightWingCache = new Map();

// Bend the same painted skin used by the neck into a static coil. Each small
// slice follows the curve's tangent, with a slight overlap to close raster seams.
function paintedSnakeBand(frame) {
  const [a, c, z] = frame ? [[-4, 0], [2.5, 11], [4, 22]] : [[-14, 0], [0, 4.5], [14, 6]];
  const points = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * z[0], u * u * a[1] + 2 * u * t * c[1] + t * t * z[1]];
  });
  return paintedSnakeStrip(points);
}

function paintedSnakeStrip(points, widthAt = () => 7) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((sum, v) => sum + v, 0);
  const skin = picture('perched-snake-skin', { x: 0, y: -3.5, w: 20, h: 7 }, 0);
  const caps = [0, 24].map((index, cap) => {
    const [x, y] = points[index], a = points[cap ? 23 : 0], z = points[cap ? 24 : 1];
    const angle = Math.atan2(z[1] - a[1], z[0] - a[0]) * 180 / Math.PI;
    const id = `coil-cap-${cap}`;
    const scale = widthAt(cap) / 7;
    return `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">${ellipse(0, 0, 3.5, 3.5, '#4d230d')}<defs><clipPath id="${id}"><circle r="3.1"/></clipPath></defs><g clip-path="url(#${id})">${picture('perched-snake-skin', { x: -3.5, y: -3.5, w: 20, h: 7 }, 0)}</g></g>`;
  }).join('');
  let along = 0;
  return caps + lengths.map((length, i) => {
    const [x, y] = points[i], to = points[i + 1], angle = Math.atan2(to[1] - y, to[0] - x) * 180 / Math.PI;
    const u = along * 20 / total, width = length * 20 / total;
    along += length;
    const height = widthAt((i + .5) / lengths.length);
    return `<g transform="translate(${x} ${y}) rotate(${angle})"><svg x="0" y="${-height / 2}" width="${length + .08}" height="${height}" viewBox="${u} -3.5 ${width + .08 * 20 / total} 7" preserveAspectRatio="none">${skin}</svg></g>`;
  }).join('');
}

function paintedFlightWing(p, frame, key, radius, shoulder) {
  if (!flightWingCache.has(p.key)) {
    const source = pictures.get(key), { joint, tip } = source.landmarks;
    const axis = registerLimb(joint, tip, radius);
    const frames = p.frames.map((_, f) => {
      const lift = -1 + 2 * f / (p.frames.length - 1);
      const dy = -radius * .8 * lift, dx = -Math.sqrt(radius ** 2 - dy ** 2);
      const angle = Math.atan2(-dx, dy), cos = Math.cos(angle), sin = Math.sin(angle);
      const [a, b, c, d, x, y] = axis;
      return [cos * a - sin * b, sin * a + cos * b, cos * c - sin * d, sin * c + cos * d,
        cos * x - sin * y + shoulder[0], sin * x + cos * y + shoulder[1]];
    });
    let fit = 1;
    for (const matrix of frames) for (const point of source.outline) {
      const placed = registeredPoint(matrix, point);
      for (let i = 0; i < 2; i++) {
        const delta = placed[i] - shoulder[i];
        const lo = (i ? p.box.y : p.box.x) + .5;
        const hi = (i ? p.box.y + p.box.h : p.box.x + p.box.w) - .5;
        if (delta > 0) fit = Math.min(fit, (hi - shoulder[i]) / delta);
        if (delta < 0) fit = Math.min(fit, (shoulder[i] - lo) / -delta);
      }
    }
    flightWingCache.set(p.key, frames.map(([a, b, c, d, x, y]) =>
      [fit * a, fit * b, fit * c, fit * d,
        shoulder[0] + fit * (x - shoulder[0]), shoulder[1] + fit * (y - shoulder[1])]));
  }
  const matrix = flightWingCache.get(p.key)[frame];
  return `<use href="#picture-${key}" transform="matrix(${matrix.join(' ')})"/>`;
}


function creature(p, frame) {
  const [family, look, part] = p.key.split('.');
  const component = part ?? look;
  const colors = (family === 'bat' || family === 'hangingBat' ? batPalettes[look] : null) ?? palettes[part ? look : 'green'] ?? palettes.green;
  let body = defs(colors);
  if (family === 'panther') {
    if (component === 'body') return picture('panther', p.box);
    if (component === 'eyes') return eyePair(frame === 1, [28, 36], -18);
    if (component === 'ear') return ellipse(0, 0, 2.1, 2.4, '#ad8585');
    if (component === 'tail') {
      const curl = -6 + frame * 12 / 15;
      return defs(palettes.black) + path(`M-33 -12 Q-52 2 -37 19 Q${-26 + curl} 26 ${-34 + curl} 15`, 'none', '#1a272e', 7) + line(`M-34 -12 Q-50 1 -37 19`, '#59676a', 1.2);
    }
  }
  if (family === 'bird' || family === 'perchedBird') {
    if (component === 'body') return family === 'bird'
      ? picture(look === 'red' ? 'parrot-flying' : `parrot-${look}-flying`, p.box)
      : colorize(picture('parrot-body', p.box), look);
    if (component === 'head') return colorize(picture('parrot-head', p.box), look);
    if (component === 'tail') return defs(colors) + path('M0 0 Q-6 -5 -10 -3L-8 1 -11 3 Q-5 6 0 0Z');
    if (component === 'wing') return paintedFlightWing(p, frame, look === 'red' ? 'parrot-wing' : `parrot-${look}-wing`, 18, [0, -3]);
  }
  if (family === 'bat' || family === 'hangingBat') {
    if (component === 'body') {
      const painted = picture(family === 'bat' ? 'bat-flying' : 'bat-hanging', p.box);
      return look === 'black' ? colorMatrix(painted, 'charcoal', '.15 .3 .15 0 .08 .15 .3 .15 0 .08 .17 .34 .17 0 .10 0 0 0 1 0') : colorize(painted, look);
    }
    if (component === 'eyes') return eyePair(frame === 1, [-3, 3], 30);
    if (component === 'ear') return body + path(`M2 36 L${6 + frame * .2} ${30 - frame * .2} L9 37Z`, colors[1], colors[2]);
    if (component === 'wing') {
      const span = look === 'grey' ? 1.1 : look === 'black' ? .9 : 1;
      // Rotate a full-size membrane about its shoulder. A constant arm length
      // avoids the old wing shortening as it passed the middle of each flap.
      const wing = paintedFlightWing(p, frame, 'bat-wing', 31 * span, [-2, -4]);
      return look === 'black' ? colorMatrix(wing, 'charcoal', '.15 .3 .15 0 .08 .15 .3 .15 0 .08 .17 .34 .17 0 .10 0 0 0 1 0', p.box) : colorize(wing, look, p.box);
    }
  }
  if (family === 'spider') {
    if (component === 'body') return picture('spider', p.box);
    if (component === 'leg') return roundStrip(p, spiderLeg);
    if (component === 'legEnd') return defs(spiderLeg) + ellipse(0, 0, 2.4, 2.4);
    if (component === 'thread') return roundStrip(p, ['#e5e2cb', '#bcc9be', '#859f9a']);
  }
  if (family === 'snake' && component === 'coil') return picture('snake-coil', p.box);
  if (family === 'snake' && component === 'head') return picture('snake-head', { x: -16, y: -29, w: 32, h: 22 }, 0);
  if (family === 'perchedSnake') {
    // A band is one strand crossing the wood, repeated by the rig. An entire
    // painted climbing-snake body here produces several overlapping snakes.
    if (component === 'band') return paintedSnakeBand(frame);
    if (component === 'neck') return picture('perched-snake-skin', p.box, 0);
    if (component === 'neckEnd') return `<defs><clipPath id="neck-cap"><circle r="3.1"/></clipPath></defs>${ellipse(0, 0, 3.5, 3.5, '#4d230d')}<g clip-path="url(#neck-cap)">${picture('perched-snake-skin', { x: -3.5, y: -3.5, w: 20, h: 7 }, 0)}</g>`;
    if (component === 'head') return picture('perched-snake-head', p.box, 0);
    if (component === 'tail') {
      const [a, b, c, d] = frame ? [[0, 0], [.5, 2], [-3.5, 2.5], [-5, -1]] : [[0, 0], [2.5, .3], [2, 3], [-3, 3]];
      const points = Array.from({ length: 25 }, (_, i) => {
        const t = i / 24, u = 1 - t;
        return [0, 1].map(j => u ** 3 * a[j] + 3 * u * u * t * b[j] + 3 * u * t * t * c[j] + t ** 3 * d[j]);
      });
      return paintedSnakeStrip(points, t => 2.8 - 2.45 * t);
    }
    if (component === 'tongue') {
      const head = pictures.get('perched-snake-head'), [mx, my] = head.landmarks.mouth;
      const box = baseline.pieces.find(piece => piece.key === 'perchedSnake.head').box;
      const x = box.x + mx / head.w * box.w, y = box.y + my / head.h * box.h;
      return line(`M${x} ${y} Q12 4.9 14.1 5.1 L16.8 3.9 M14.1 5.1 L16.9 5.55`, '#d97769', .75);
    }
  }
  if (family === 'perchedSnake' && component === 'mark') return body + path('M-2 0L0 -2 2 0 0 2Z', '#8f431e', 'none');
  if ((family === 'snake' && component === 'stalkLeaf')) return `<g transform="scale(${frame ? -1 : 1} 1) translate(0 -3)">${defs()}${leaf(15, 4)}</g>`;
  if (family === 'hangingMonkey') {
    if (component === 'arms') {
      const { landmarks } = pictures.get('monkey-arm');
      const matrix = registerLimb(landmarks.joint, landmarks.tip, Math.hypot(2.5, 25));
      return colorize([-1, 1].map((side) => {
        const angle = Math.atan2(-side * 2.5, -25) * 180 / Math.PI;
        return `<g transform="translate(${side * 7} 25) rotate(${angle}) scale(${side * .55} 1)"><use href="#picture-monkey-arm" transform="matrix(${matrix.join(' ')})"/></g>`;
      }).join(''), 'russet');
    }
    if (component === 'body') {
      const matrix = hangingTorsoMatrix();
      return colorize(`<use href="#picture-monkey-torso" transform="matrix(${matrix.join(' ')})"/><use href="#picture-hanging-monkey-head" transform="matrix(${hangingHeadMatrix().join(' ')})"/>`, 'russet');
    }
    if (component === 'tail') return colorize(`<g transform="translate(3 32) rotate(${177 + frame * 6 / (p.frames.length - 1)})">${picture('monkey-tail', { x: -24, y: -20, w: 24, h: 20 }, 0)}</g>`, 'russet');
    if (component === 'eyes') return `<g transform="matrix(${hangingHeadMatrix().join(' ')})">${monkeyEyes(frame, true, 'hanging-monkey-head')}</g>`;
    if (component === 'leg') return roundStrip(p, ['#b9b7ac', '#77756e', '#45463f']);
    if (component === 'legEnd') return ellipse(.5, 1, 3, 2, '#b9b4a4', 'stroke="#4b4a42" stroke-width=".6"')
      + line('M1 1.5V2.5M2.3 1.1V2.1', '#777266', .4);
  }
  // Precisely pivoted line/joint parts are continuous shaded strips, not pictures
  // of entire creatures. Width/length come from the original rig contract.
  if (/End$/.test(component)) return body + ellipse(0, 0, Math.min(p.box.w, p.box.h) / 2 - .6, Math.min(p.box.w, p.box.h) / 2 - .6);
  if (['leg', 'thread', 'stalk', 'neck'].includes(component)) return roundStrip(p, family === 'spider' ? palettes.black : family === 'hangingMonkey' ? palettes.grey : palettes.green);
  throw new Error(`Unpainted creature: ${p.key}`);
}

function prop(p, frame) {
  const [family, part] = p.key.split('.');
  const { x, y, w, h } = p.box;
  let body = defs(family === 'bee' || family === 'beehive' || family === 'banana' ? palettes.gold : palettes.brown);
  if (family === 'liana') {
    const [, look, component] = p.key.split('.');
    if (look === 'flash') return roundStrip(p, ['#fff7b5', '#f8d665', '#eba847']);
    const palette = look === 'gold' ? palettes.gold : look === 'shadow' ? palettes.grey : lianaGreen;
    if (component === 'rope') return look === 'green' ? greenRope(p) : roundStrip(p, palette);
    return defs(frame ? [palette[1], palette[2], palette[2]] : palette) + leaf(17, 5);
  }
  if (family === 'branch') {
    if (part === 'body') return picture('branch', { x: -83, y: -18, w: 164, h: 24 });
    if (part === 'trunk') return pillar(p.box);
    if (part === 'barkLine') return line('M0 0 Q6 3 14 0', '#765534', 1.2) + line('M1 -1Q6 1 13 -1', '#d4aa63', .55);
  }
  if (family === 'support') {
    if (part === 'stem' || part === 'hiveTrunk') return pillar(p.box);
    if (part === 'vine') return greenRope(p, ['#f0edb4', '#bfce72', '#6d8c42']);
    if (part === 'vineEnd') return ellipse(0, 0, 1.3, 1.3, '#bfce72', 'stroke="#293f28" stroke-width=".5"');
  }
  if (family === 'thornBush') {
    if (part === 'body') return picture('thorn-bush', p.box);
    if (part === 'thorn') return path('M0 -3L7 0 0 3Z', '#eee3af', '#67794b', .7);
    if (part === 'mound') return picture('wood-platform', p.box);
  }
  if (family === 'rock') {
    if (part === 'body') {
      const { key, scale, x, y } = rockPlacement(frame);
      return `<use href="#picture-${key}" transform="translate(${x} ${y}) scale(${scale})"/>`;
    }
    if (part === 'sling') return line('M-34 -6Q-25 13 0 3Q24 10 34 -9', '#97ac56', 4) + line('M-34 -7Q-25 11 0 1Q24 8 34 -10', '#d1cc83', 1);
    if (part === 'ledge') return picture('wood-platform', p.box);
  }
  if (family === 'beehive') {
    if (part === 'nest') {
      body += path('M0 -34Q23 -22 20 -7Q30 8 20 25Q16 42 0 40Q-17 39 -19 24Q-30 8 -20 -8Q-23 -24 0 -34Z', 'url(#paint)', '#865b32', 1.1);
      for (const y of [-21, -8, 6, 20, 32]) body += line(`M-17 ${y} Q0 ${y + 5} 17 ${y}`, '#936335', 1.3);
      return body + ellipse(3, 26, 6, 6, '#392d24') + line('M-3 20Q3 18 9 20', '#ffe8a0', .8);
    }
    return line('M0 -49 V-32', '#344d29', 3.2) + line('M-.5 -48 V-33', '#a5b957', 1.3)
      + picture('wood-platform', { x: -8, y: -56, w: 52, h: 11 }, 0);
  }
  if (family === 'bee') {
    if (part === 'wing') return ellipse(0, 0, 3, 3.4, '#e0f5ec', 'opacity=".76" stroke="#95c7c9" stroke-width=".5"');
    return body + ellipse(0, 0, 4.5, 3.2) + rect(-1, -3, 1.8, 6, '#503827') + ellipse(3, -1, .8, .9, '#2e2820');
  }
  if (family === 'banana') {
    if (part === 'glint') return path('M0 -8L2 -2 8 0 2 2 0 8 -2 2 -8 0 -2 -2Z', '#fff6bd', 'none');
    body = defs(['#fff3ad', '#ffd653', '#d8952e']);
    body += `<g transform="translate(${x + w / 2} ${y + h / 2}) scale(${w / 44} ${h / 34})">${path('M-18 -9Q-4 6 13 -11Q20 -5 11 8Q-3 19 -19 5Q-23 -1 -18 -9Z', 'url(#paint)', '#443122', 2.3)}${line('M-16 -6Q-5 9 11 0', '#fff6bf', 2)}${path('M10 -10L12 -15 17 -14 16 -9Z', '#71532c', '#443122', .8)}</g>`;
    return body;
  }
  if (family === 'heart') return `<g transform="translate(${x + w / 2} ${y + h / 2}) scale(${w / 40} ${h / 32})">${defs(['#ffb2a0', '#df6570', '#a13e57'])}${path('M0 13C-7 8 -20 0 -17 -8C-13 -16 -4 -12 0 -6C4 -12 13 -16 17 -8C20 0 7 8 0 13Z', frame ? 'none' : 'url(#paint)', '#edc4a0', frame ? 2 : 1)}${frame ? '' : line('M-12 -7Q-8 -11 -3 -6', '#ffe6c9', 1.8)}</g>`;
  if (family === 'nest') {
    const straw = ['#efd08b', '#b77b43', '#67402b'];
    if (['twig', 'lightTwig', 'rimTwig'].some((v) => part.startsWith(v))) return part.endsWith('End') ? defs(straw) + ellipse(0, 0, .6, .6) : roundStrip(p, straw);
    const shellColors = ['#fff9df', '#eee2be', '#c7b88f'];
    if (part === 'egg') return defs(shellColors) + path('M0 -8C-3 -8 -6 -1 -6 2C-6 10 6 10 6 2C6 -1 3 -8 0 -8Z', 'url(#paint)', '#5b4530', .9)
      + ellipse(-2, -2, 1.8, 3, '#fffdec', 'opacity=".7"')
      + [[2, 1], [-2, 4], [1, -4]].map(([x, y]) => ellipse(x, y, .7, .5, '#a38b63')).join('');
    if (part === 'shell') return defs(shellColors) + path('M-6 -2L-4 -4 -2 -1 0 -4 2 -1 4 -4 6 -2L6 3Q0 8 -6 3Z', 'url(#paint)', '#5b4530', .8);
    if (part === 'cap') return defs(shellColors) + path('M-6 0L-4 -4 -2 -1 0 -5 2 -1 4 -4 6 0L5 3H-5Z', 'url(#paint)', '#5b4530', .8);
    if (part === 'chick') return defs(['#fff2a0', '#f3c84e', '#c58b32'])
      + path('M-6 1Q-7 -4 -3 -6L-2 -9 0 -7 2 -9 3 -6Q8 -3 6 3Q3 8 -2 6Q-6 5 -6 1Z', 'url(#paint)', '#634628', .8)
      + ellipse(-3, 2, 2, 2.5, '#d6a640') + ellipse(2.4, -2, 1.2, 1.6, '#302923') + ellipse(2.7, -2.6, .4, .5, '#fff9de');
    if (part === 'chickBeak') return path(`M5 -2L10 ${-1 - frame * .25}L11 1L10 ${2 + frame * .35}L5 2Z`, '#f5a945', '#634628', .7);
    if (part === 'leaf') return defs(['#d7af69', '#ab763d', '#66452e']) + `<g transform="translate(-3 -9)">${leaf(10, 3)}</g>`;
    // A hollow back, shallow front wall, and an open curved lip. The old
    // filled rim was a third bowl covering the egg and chick's cracked shell.
    if (part === 'back') return defs(straw)
      + ellipse(0, -9, 19, 7, 'url(#paint)', 'stroke="#4b3022" stroke-width="1.2"')
      + ellipse(0, -9, 15.8, 4.7, '#503426')
      + line('M-15 -11Q0 -18 15 -11', '#f0ce83', 1.1);
    if (part === 'front') {
      body = defs(straw) + path('M-20 -9Q0 -1 20 -9Q20 3 0 4Q-20 3 -20 -9Z', 'url(#paint)', '#4b3022', 1.2);
      for (let i = 0; i < 3; i++) body += line(`M${-18 + i * 2} ${-5 + i * 3}Q0 ${4 + i * 2} ${18 - i * 2} ${-5 + i * 3}`, i % 2 ? '#6e4329' : '#e5bd79', 1);
      for (const x of [-14, -7, 0, 7, 14]) body += line(`M${x - 2} -3l4 5`, '#8b552f', .7);
      return body;
    }
    if (part === 'rim') return line('M-20 -9Q0 0 20 -9', '#4b3022', 2.6) + line('M-20 -9Q0 0 20 -9', '#e8bb73', 1.2);
  }
  if (family === 'flower') {
    if (part === 'stem') return defs() + line('M0 0Q4 -12 0 -20', '#283623', 3) + line('M0 0Q4 -12 0 -20', '#86b955', 1.6) + `<g transform="translate(0 -9) rotate(-45)">${leaf(7, 2)}</g>`;
    if (part === 'leaf') return defs() + `<g transform="scale(${frame ? -1 : 1} 1)">${leaf(7, 2)}</g>`;
    // Petal colors are still supplied by the rig; the dark rim survives tinting.
    return defs(part === 'heart' ? ['#fff1a2', '#ffd260', '#d49436'] : ['#fff8e9', '#f6dfc9', '#e2bda2'])
      + ellipse(0, 0, 4, 4, 'url(#paint)', 'stroke="#393026" stroke-width="1.15"')
      + ellipse(-1, -1, 1.6, 1.6, '#fff9df', 'opacity=".7"');
  }
  if (family === 'coconut') {
    if (part === 'frond') return defs() + Array.from({ length: 5 }, (_, i) => `<g transform="rotate(${25 + i * 29})">${leaf(15, 3)}</g>`).join('');
    if (part === 'nut') return defs(['#f3ca87', '#bd8247', '#744329'])
      + ellipse(0, 7, 7, 7, 'url(#paint)', 'stroke="#392a20" stroke-width="1.25"')
      + line('M-5 7Q-5 2 -1 1', '#ffe1a4', 1.2)
      + line('M4 5Q6 9 2 12', '#80502e', .6)
      + [[-2, 5], [1, 5], [0, 7]].map(([x, y]) => ellipse(x, y, .65, .8, '#513323')).join('');
    if (part === 'hair') return line('M5 0L8 -2M5 1L9 2', '#784c2e', .8);
    if (part === 'stemEnd') return body + ellipse(0, 0, 1.4, 1.4);
    if (part === 'stem') return roundStrip(p, palettes.brown);
  }
  if (family === 'owl') {
    if (part === 'body') return body + path('M-12 -25Q0 -31 12 -25Q17 -4 7 2L0 4 -7 2Q-17 -4 -12 -25Z') + path('M-8 -12Q0 -2 8 -12L6 1H-6Z', '#e2cb9a', 'none');
    if (part === 'skull') return body + path('M-10 -12L-7 -16 0 -11 7 -16 10 -12Q14 4 8 9H-8Q-14 4 -10 -12Z');
    if (part === 'disc') return defs(['#ffedc0', '#d6b886', '#9c795a']) + ellipse(-5, 0, 6, 6) + ellipse(5, 0, 6, 6);
    if (part === 'eyeball') return ellipse(0, 0, 4, 4.5, '#e5bb55') + ellipse(-1, -1, 1.5, 1.7, '#f8d787');
    if (part === 'pupil') return ellipse(0, 0, 2.4, 2.8, '#29342c') + ellipse(.6, -.7, .6, .7, '#fff6d5');
    if (part === 'shutEye') return line('M-4 -1Q0 3 4 -1', '#4c3e2d', 1.3);
    if (part === 'beak') return path('M-2 0L0 5 2 0Z', '#d5a445', '#745637', .5);
  }
  if (family === 'ui') {
    if (part === 'panel') return defs(['#72846a', '#385345', '#19362d']) + path('M18 0H46Q64 0 64 18V46Q64 64 46 64H18Q0 64 0 46V18Q0 0 18 0Z', '#17342be8', '#a7a46b', 1.2) + line('M5 20Q5 5 20 5M44 5Q59 5 59 20M59 44Q59 59 44 59M20 59Q5 59 5 44', '#798b63', 1);
    if (part === 'arrow') return defs(palettes.gold) + path('M0 0L11 11H5V25H-5V11H-11Z', 'url(#paint)', '#6c603a', 1);
    if (part === 'speaker') return defs(palettes.gold) + path('M1 13H8L21 2V38L8 27H1Z', 'url(#paint)', '#64734f', 1.5) + line('M16 8V32', '#ffecc0', 1);
    if (part === 'speakerWaves') return line('M28 12Q38 20 28 28M34 6Q51 20 34 34', '#f1dd9b', 2.5);
    if (part === 'speakerCross') return line('M25 9L44 29M44 9L25 29', '#e9cb86', 3);
    if (part === 'fullscreen') return line(frame ? 'M0 12H12V0M26 0V12H38M38 26H26V38M12 38V26H0' : 'M0 12V0H12M26 0H38V12M38 26V38H26M12 38H0V26', '#e7d69a', 3);
  }
  throw new Error(`Unpainted prop: ${p.key}`);
}

const manifest = structuredClone(baseline);
const changedFrames = new Set();
for (const p of manifest.pieces) {
  if (p.alpha !== undefined) p.alpha = packAlpha('cartoon', p);
  const count = packFrameCount('cartoon', p);
  for (let i = count; i < p.frames.length; i++) {
    const retired = new URL(`generated/${frameName(p, i)}.svg`, root);
    if (existsSync(retired)) unlinkSync(retired);
  }
  p.frames = p.frames.slice(0, count);
  if (p.key === 'rock.body') p.purpose = 'Six distinct painted jungle boulders, selected by gap; origin at the unchanged collision centre.';
  p.frames = p.frames.map((_, i) => {
    paintBox = p.box;
    const family = p.key.split('.')[0];
    let body = family === 'monkey' ? monkey(p, i) : family === 'backdrop' ? scenery(p)
      : family === 'temple' ? temple(p, i) : ['panther', 'perchedBird', 'bird', 'hangingBat', 'bat', 'spider', 'snake', 'perchedSnake', 'hangingMonkey'].includes(family) ? creature(p, i) : prop(p, i);
    const name = `generated/${frameName(p, i)}.svg`;
    const used = [...new Set([...body.matchAll(/href="#picture-([\w-]+)"/g)].map((match) => match[1]))];
    body = `<defs>${used.map((key) => { const pic = pictures.get(key); return `<image id="picture-${key}" width="${pic.w}" height="${pic.h}" href="${pic.uri}"/>`; }).join('')}</defs>` + body;
    // Each source is embedded into a shared atlas SVG. Gradient/filter names must
    // remain local to its frame rather than recoloring its neighbors.
    const prefix = `${frameName(p, i).replaceAll('.', '-')}-`;
    body = body.replace(/id="([\w-]+)"/g, (_, id) => `id="${prefix}${id}"`).replace(/url\(#([\w-]+)\)/g, (_, id) => `url(#${prefix}${id})`).replace(/href="#([\w-]+)"/g, (_, id) => `href="#${prefix}${id}"`);
    const svg = document(`<g${p.alpha !== undefined ? ` opacity="${p.alpha}"` : ''}>${body}</g>${guideLayer(p)}`, p.box) + '\n';
    const file = new URL(name, root);
    if (!existsSync(file) || readFileSync(file, 'utf8') !== svg) changedFrames.add(frameName(p, i));
    writeFileSync(file, svg);
    return name;
  });
}
// A deliberately authored wordmark, not variable menu wording baked into art.
const wordmark = { key: 'ui.wordmark', purpose: 'Cartoon stone title with the concept sun/spiral O.', kind: 'sprite', set: 'boot', box: { x: -160, y: -40, w: 320, h: 80 }, scale: 1, tint: false, frames: ['generated/ui.wordmark.svg'] };
paintBox = wordmark.box;
let letters = defs(palettes.gold);
const glyphs = [
  'M-151 -28H-132V17H-111V32H-151Z', 'M-103 -28H-84V32H-103Z',
  'M-78 32L-60 -28H-38L-20 32H-38L-42 17H-58L-62 32Z M-55 3H-46L-50 -13Z',
  'M-12 32V-28H6L30 8V-28H48V32H30L6 -4V32Z',
];
for (const d of glyphs) letters += path(d, 'url(#paint)', '#6c5939', 2, 'fill-rule="evenodd"') + line(d, '#ffe8a0', .5);
letters += ellipse(98, 1, 34, 33, 'url(#paint)', 'stroke="#6c5939" stroke-width="2"') + line('M111 15Q78 28 77 0Q76 -18 99 -15Q120 -12 111 4Q103 16 95 6Q88 -3 102 -3', '#826b3d', 3);
for (let i = 0; i < 10; i++) letters += `<g transform="translate(98 1) rotate(${i * 36})">${path('M-5 -36L-7 -40H7L5 -36Z', 'url(#paint)', '#846b3d', 1)}</g>`;
writeFileSync(new URL(wordmark.frames[0], root), document(letters + guideLayer(wordmark), wordmark.box));
manifest.pieces.push(wordmark);
const torsoLandmarks = pictures.get('monkey-torso').landmarks;
manifest.presentation = {
  title: 'ui.wordmark', coconutRootY: 1, snakeLimbThickness: 10, snakePoleThickness: 19, perchedSnakeTaperedEnd: true,
  standingBranchJoin: { top: -12, details: true }, perchedSnakeNeckSocket: [-3, 1], perchedSnakePaintedSkin: true, perchedSnakeContinuous: true,
  pantherSeatY: 2, hangingBatRootY: 1,
  climbingSnake: 'articulated', monkeyRootY: -3, monkeyLimbsBehindBody: true, monkeyMirrorFrontLeg: true,
  hangingMonkeyLegTint: hangingMonkeyTint,
  hangingMonkeyHips: [torsoLandmarks.hipBack, torsoLandmarks.hipFront].map((point) => registeredPoint(hangingTorsoMatrix(), point)),
  batWingOffset: [6, 4], templeFireDaylight: .18,
  rasterScale: { 'branch.body': 2, ...Object.fromEntries(['red', 'blue', 'purple'].map(look => [`bird.${look}.wing`, 2.5])) },
  flyingWings: {
    bird: { root: [0, -3], near: { x: 3, y: 0, scale: 3 }, far: { x: 3, y: -2, scale: 2.55, flapRotation: .3, tint: 0xd2d9e3 } },
    bat: { root: [-2, -4], near: { x: 4, y: 0, scale: 1.2 }, far: { x: 5, y: -2, scale: 1.08, flapRotation: .6, tint: 0xd2d9e3 } },
  },
  // Seat stones two world pixels into the painted shelf so the contact feels
  // planted rather than balancing on the soft outline's first touching pixel.
  standingRockY: manifest.pieces.find((p) => p.key === 'rock.body').frames.map((_, frame) =>
    n(2 + Math.min(...rockOutline(frame).map(([x, y]) => platformTopAt(x) - y)))),
  hangingRockSling: false,
  hangingRockVineY: manifest.pieces.find((p) => p.key === 'rock.body').frames.map((_, frame) => {
    const points = rockOutline(frame);
    const crossings = [];
    for (let i = 0; i < points.length; i += 2) {
      const [left, right] = [points[i], points[i + 1]];
      if (left[0] <= 0 && right[0] >= 0) crossings.push(left[1]);
    }
    // Extend into the painted top edge; the opaque stone covers the rope tip.
    return n(Math.min(...crossings) + 1.5);
  }),
};
writeFileSync(new URL('manifest.json', root), JSON.stringify(manifest, null, 2) + '\n');
const previous = JSON.parse(readFileSync(new URL('inventory.json', root)));
const inventory = cartoonInventory(baseline, previous);
for (const piece of inventory.pieces) for (let i = 0; i < piece.frames.length; i++) {
  const frame = piece.frames[i];
  Object.assign(frame, { source: `generated/${frameName(piece, i)}.svg`, status: frame.status === 'reviewed' && !changedFrames.has(frame.key) ? 'reviewed' : 'painted' });
  if (!frame.notes) frame.notes = 'Exported from painted component masters and cartoon vector recipes; gameplay review pending.';
}
writeFileSync(new URL('inventory.json', root), JSON.stringify(inventory, null, 2) + '\n');
console.log(`Cartoon sources: ${manifest.pieces.length} pieces, ${manifest.pieces.reduce((sum, p) => sum + p.frames.length, 0)} frames; no classic drawing inputs.`);
