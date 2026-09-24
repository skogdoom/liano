// Renders the app icon (monkey on a vine) to PNGs in public/icons, with no
// dependencies: shapes are sampled 4×4 per pixel and encoded with node:zlib.
// Run with `npm run icons` after changing the design.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZES = [180, 192, 512];
const OUT = new URL('../public/icons/', import.meta.url);

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Design space is 512 × 512. Later shapes are drawn on top.
const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const ellipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const capsule = (ax, ay, bx, by, r) => (x, y) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0), 1);
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= r * r;
};
const smile = (x, y) => {
  const d = Math.hypot(x - 270, y - 335);
  return d >= 30 && d <= 38 && y > 350;
};

const FUR = hex(0x6e4322);
const SKIN = hex(0xe0ad74);
const MUZZLE = hex(0xf0c894);
const EYE = hex(0x1c1008);
const shapes = [
  [capsule(120, -20, 262, 210, 22), hex(0x2c5219)],
  [capsule(120, -20, 262, 210, 13), hex(0x6da539)],
  [circle(150, 236, 50), FUR],
  [circle(390, 236, 50), FUR],
  [circle(150, 236, 27), SKIN],
  [circle(390, 236, 27), SKIN],
  [circle(270, 300, 122), FUR],
  [ellipse(270, 326, 90, 80), SKIN],
  [ellipse(270, 352, 46, 30), MUZZLE],
  [circle(236, 298, 14), EYE],
  [circle(304, 298, 14), EYE],
  [circle(240, 293, 4), hex(0xffffff)],
  [circle(308, 293, 4), hex(0xffffff)],
  [smile, EYE],
];
const TOP = hex(0x10261a);
const BOTTOM = hex(0x3a7050);

function colorAt(x, y) {
  for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i][0](x, y)) return shapes[i][1];
  return lerp(TOP, BOTTOM, y / 512);
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
