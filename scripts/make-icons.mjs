// Renders the app icon (monkey on a vine) to PNGs in public/icons and to
// public/favicon.svg, with no dependencies: for the PNGs, shapes are sampled
// 4×4 per pixel and encoded with node:zlib.
// Run with `npm run icons` after changing the design.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZES = [180, 192, 512];
const OUT = new URL('../public/icons/', import.meta.url);

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Design space is 512 × 512. Later shapes are drawn on top. Each shape is data, so
// the same design renders to the PNGs and to the SVG favicon.
const FUR = 0x6e4322;
const SKIN = 0xe0ad74;
const MUZZLE = 0xf0c894;
const EYE = 0x1c1008;
const TOP = 0x10261a;
const BOTTOM = 0x3a7050;
const SMILE = { cx: 270, cy: 335, r: 34, width: 8, above: 350 };
const shapes = [
  { kind: 'capsule', ax: 120, ay: -20, bx: 262, by: 210, r: 22, color: 0x2c5219 },
  { kind: 'capsule', ax: 120, ay: -20, bx: 262, by: 210, r: 13, color: 0x6da539 },
  { kind: 'circle', cx: 150, cy: 236, r: 50, color: FUR },
  { kind: 'circle', cx: 390, cy: 236, r: 50, color: FUR },
  { kind: 'circle', cx: 150, cy: 236, r: 27, color: SKIN },
  { kind: 'circle', cx: 390, cy: 236, r: 27, color: SKIN },
  { kind: 'circle', cx: 270, cy: 300, r: 122, color: FUR },
  { kind: 'ellipse', cx: 270, cy: 326, rx: 90, ry: 80, color: SKIN },
  { kind: 'ellipse', cx: 270, cy: 352, rx: 46, ry: 30, color: MUZZLE },
  { kind: 'circle', cx: 236, cy: 298, r: 14, color: EYE },
  { kind: 'circle', cx: 304, cy: 298, r: 14, color: EYE },
  { kind: 'circle', cx: 240, cy: 293, r: 4, color: 0xffffff },
  { kind: 'circle', cx: 308, cy: 293, r: 4, color: 0xffffff },
  { kind: 'smile', ...SMILE, color: EYE },
];

function inside(s, x, y) {
  switch (s.kind) {
    case 'circle':
      return (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r * s.r;
    case 'ellipse':
      return ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1;
    case 'capsule': {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const t = Math.min(Math.max(((x - s.ax) * dx + (y - s.ay) * dy) / (dx * dx + dy * dy), 0), 1);
      return (x - s.ax - t * dx) ** 2 + (y - s.ay - t * dy) ** 2 <= s.r * s.r;
    }
    case 'smile': {
      const d = Math.hypot(x - s.cx, y - s.cy);
      return Math.abs(d - s.r) <= s.width / 2 && y > s.above;
    }
  }
}

const css = (c) => `#${c.toString(16).padStart(6, '0')}`;
function svgShape(s) {
  const fill = css(s.color);
  switch (s.kind) {
    case 'circle':
      return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${fill}"/>`;
    case 'ellipse':
      return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${fill}"/>`;
    case 'capsule':
      return `<line x1="${s.ax}" y1="${s.ay}" x2="${s.bx}" y2="${s.by}" stroke="${fill}" stroke-width="${2 * s.r}" stroke-linecap="round"/>`;
    case 'smile': {
      const dx = +Math.sqrt(s.r ** 2 - (s.above - s.cy) ** 2).toFixed(1);
      return `<path d="M${s.cx - dx} ${s.above}A${s.r} ${s.r} 0 0 0 ${s.cx + dx} ${s.above}" fill="none" stroke="${fill}" stroke-width="${s.width}"/>`;
    }
  }
}

function svg() {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    `<defs><linearGradient id="bg" x2="0" y2="1"><stop offset="0" stop-color="${css(TOP)}"/><stop offset="1" stop-color="${css(BOTTOM)}"/></linearGradient></defs>`,
    '<rect width="512" height="512" rx="96" fill="url(#bg)"/>',
    ...shapes.map(svgShape),
    '</svg>',
    '',
  ].join('\n');
}

function colorAt(x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) if (inside(shapes[i], x, y)) return hex(shapes[i].color);
  return lerp(hex(TOP), hex(BOTTOM), y / 512);
}

function render(size) {
  const n = 4;
  const scale = 512 / size;
  const rows = Buffer.alloc(size * (1 + size * 3));
  for (let py = 0; py < size; py++) {
    const row = py * (1 + size * 3);
    rows[row] = 0; // PNG filter: none
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const c = colorAt((px + (sx + 0.5) / n) * scale, (py + (sy + 0.5) / n) * scale);
          sum[0] += c[0];
          sum[1] += c[1];
          sum[2] += c[2];
        }
      }
      for (let k = 0; k < 3; k++) rows[row + 1 + px * 3 + k] = Math.round(sum[k] / (n * n));
    }
  }
  return rows;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rows) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of SIZES) {
  writeFileSync(new URL(`icon-${size}.png`, OUT), png(size, render(size)));
  console.log(`icon-${size}.png`);
}
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg());
console.log('favicon.svg');
