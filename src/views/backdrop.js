import { WORLD_HEIGHT } from '../config.js';
import { mulberry32 } from '../sim/rng.js';
import { leafPoints, mixColor } from '../render/shapes.js';

// The backdrop: what both versions draw from (no Pixi here). Colours, sizes, the drawing
// functions (the Pixi view draws with them, and the art pieces are generated from them),
// and where things go and how they move. The Pixi view is render/background.js.

// Jungle backdrop: a fixed sky gradient, three parallax layers behind the world, and
// a canopy strip and floor band in front of it that scroll with the world.
//
// Layers are static geometry drawn once into a tile and shown as two copies, so a
// frame only moves containers. Colours are opaque: shapes near a tile edge are drawn
// again one tile to each side, and overlapping copies must look identical.

export const TILE = 2048;
export const FLOOR_Y = WORLD_HEIGHT - 60;
export const CANOPY_BOTTOM = 34;

// Taller views (portrait, 4:3) show this much forest above the world band and
// undergrowth below it.
export const EXTEND_UP = 1000;
export const EXTEND_DOWN = 1600;

export const SKY_TOP = 0x10261a;
export const SKY_BOTTOM = 0x4a8060;
// The sky is SKY_BANDS bands of colour, from the top of the view to the floor.
export const SKY_BANDS = 32;
export const skyBand = (i) => mixColor(SKY_TOP, SKY_BOTTOM, i / (SKY_BANDS - 1));

// Calls draw(x) for x and its wrapped positions one tile either side.
export function wrapped(x, draw) {
  draw(x - TILE);
  draw(x);
  draw(x + TILE);
}

// Extends past the screen edges so the death shake never uncovers the letterbox.
export const SKY_MARGIN = 24;

// The sky gradient, from the top of the view (`top`, a world y) to the floor, then
// flat down to the bottom of the view; `width` is the view width.
export function drawSky(g, top, width, bottom) {
  g.clear();
  const bands = SKY_BANDS;
  const start = Math.min(top, 0);
  const h = (FLOOR_Y - start) / bands;
  const x = -SKY_MARGIN;
  const w = width + 2 * SKY_MARGIN;
  for (let i = 0; i < bands; i++) {
    const y = start + i * h;
    const from = i === 0 ? y - SKY_MARGIN : y;
    g.rect(x, from, w, y + h - from + 1).fill(skyBand(i));
  }
  return g.rect(x, FLOOR_Y, w, Math.max(bottom, WORLD_HEIGHT) - FLOOR_Y + SKY_MARGIN).fill(SKY_BOTTOM);
}

// How fast the far layer scrolls, as a share of the camera's speed.
export const FAR_FACTOR = 0.15;

// One tile (TILE wide, repeating) of the far layer (also as a piece for the Phaser version).
export function drawFarLayer(ctx) {
  const rand = mulberry32(101);
  const trunk = 0x3c6c4d;
  const crown = 0x284d37;
  for (let i = 0; i < 16; i++) {
    const x = rand() * TILE;
    const w = 14 + rand() * 22;
    wrapped(x, (px) => ctx.rect(px - w / 2, 60, w, FLOOR_Y - 60).fill(trunk));
  }
  for (let i = 0; i < 40; i++) {
    const x = rand() * TILE;
    const y = 30 + rand() * 150;
    const r = 60 + rand() * 70;
    wrapped(x, (px) => ctx.circle(px, y, r).fill(crown));
  }
  // Above the band, for taller views: trunk tops and more crowns.
  const upper = mulberry32(111);
  for (let i = 0; i < 16; i++) {
    const x = upper() * TILE;
    const w = 14 + upper() * 22;
    wrapped(x, (px) => ctx.rect(px - w / 2, -EXTEND_UP, w, EXTEND_UP).fill(trunk));
  }
  for (let i = 0; i < 90; i++) {
    const x = upper() * TILE;
    const y = -EXTEND_UP + upper() * EXTEND_UP;
    const r = 60 + upper() * 70;
    wrapped(x, (px) => ctx.circle(px, y, r).fill(crown));
  }
  return ctx;
}

export const MID_FACTOR = 0.4;

// One tile of the mid layer.
export function drawMidLayer(ctx) {
  const rand = mulberry32(202);
  const trunk = 0x223d2b;
  for (let i = 0; i < 9; i++) {
    const x = rand() * TILE;
    const w = 34 + rand() * 30;
    const stubs = Array.from({ length: 2 }, () => ({ y: 180 + rand() * 300, side: rand() < 0.5 ? -1 : 1, len: 30 + rand() * 50 }));
    wrapped(x, (px) => {
      ctx.rect(px - w / 2, -EXTEND_UP, w, EXTEND_UP).fill(trunk); // above the band
      ctx.poly([px - w / 2, 0, px + w / 2, 0, px + w / 2 + 6, FLOOR_Y + 10, px - w / 2 - 6, FLOOR_Y + 10]).fill(trunk);
      for (const s of stubs) {
        const x0 = px + (s.side * w) / 2;
        ctx.poly([x0, s.y, x0 + s.side * s.len, s.y - 22, x0 + s.side * s.len, s.y - 14, x0, s.y + 12]).fill(trunk);
      }
    });
  }
  return ctx;
}

export const NEAR_FACTOR = 0.7;

// One tile of the near layer.
export function drawNearLayer(ctx) {
  const rand = mulberry32(303);
  const leaf = 0x1b3624;
  for (let i = 0; i < 22; i++) {
    const x = rand() * TILE;
    const size = 50 + rand() * 50;
    const fronds = 5 + Math.floor(rand() * 3);
    wrapped(x, (px) => {
      for (let f = 0; f < fronds; f++) {
        const a = -Math.PI / 2 + (f / (fronds - 1) - 0.5) * 2.2;
        ctx.poly(leafPoints(px, FLOOR_Y + 8, a, size, size * 0.28)).fill(leaf);
      }
    });
  }
  for (let i = 0; i < 18; i++) {
    const x = rand() * TILE;
    const n = 3 + Math.floor(rand() * 3);
    wrapped(x, (px) => {
      for (let f = 0; f < n; f++) {
        const a = Math.PI / 2 + (f / Math.max(n - 1, 1) - 0.5) * 1.6;
        ctx.poly(leafPoints(px, CANOPY_BOTTOM - 4, a, 40 + ((f * 13) % 25), 16)).fill(leaf);
      }
    });
  }
  return ctx;
}

// One tile of the canopy strip.
export function drawCanopyLayer(ctx) {
  const rand = mulberry32(404);
  const dark = 0x0f2517;
  const light = 0x1d4429;
  ctx.rect(-TILE, -SKY_MARGIN, 3 * TILE, CANOPY_BOTTOM - 8 + SKY_MARGIN).fill(dark);
  for (let x = 0; x < TILE; x += 18 + rand() * 18) {
    const r = 10 + rand() * 14;
    const y = CANOPY_BOTTOM - 14 + rand() * 10;
    wrapped(x, (px) => ctx.circle(px, y, r).fill(dark));
  }
  for (let i = 0; i < 70; i++) {
    const x = rand() * TILE;
    const y = 4 + rand() * (CANOPY_BOTTOM - 6);
    const a = rand() * Math.PI * 2;
    wrapped(x, (px) => ctx.poly(leafPoints(px, y, a, 16, 7)).fill(light));
  }
  // A leafy top edge, seen only in taller views. The bumps overlap the strip's top
  // (y −24) and stay above y −10, out of sight in 16:9 even during the death shake.
  const top = mulberry32(414);
  for (let x = 0; x < TILE; x += 18 + top() * 18) {
    const r = 10 + top() * 10;
    wrapped(x, (px) => ctx.circle(px, -SKY_MARGIN - 0.3 * r, r).fill(dark));
  }
  return ctx;
}

// One tile of the floor.
export function drawFloorLayer(ctx) {
  const rand = mulberry32(505);
  const floor = 0x0a140d;
  const growth = 0x0f1e14;
  ctx.rect(-TILE, FLOOR_Y, 3 * TILE, WORLD_HEIGHT - FLOOR_Y + EXTEND_DOWN).fill(floor);
  for (let x = 0; x < TILE; x += 10 + rand() * 16) {
    const h = 10 + rand() * 22;
    const lean = (rand() - 0.5) * 12;
    wrapped(x, (px) => ctx.poly([px - 5, FLOOR_Y + 4, px + lean, FLOOR_Y - h, px + 5, FLOOR_Y + 4]).fill(growth));
  }
  for (let x = 0; x < TILE; x += 40 + rand() * 60) {
    const r = 14 + rand() * 16;
    wrapped(x, (px) => ctx.circle(px, FLOOR_Y + 6, r).fill(growth));
  }
  return ctx;
}

// Multiplied over the whole background per stage: day, late afternoon, dusk, night, and
// dawn, after which the day starts over (stage n has tint n - 1 modulo the five).
export const STAGE_TINTS = [0xffffff, 0xffc27a, 0xc88cb4, 0x6474b4, 0xf0b4a4];
// Seconds to shift to the next stage's tint.
export const TINT_TIME = 2.5;

// The background tint `t` (0..1) of the way from colour `from` to `to`, eased.
export function tintBetween(from, to, t) {
  const u = Math.min(Math.max(t, 0), 1);
  return mixColor(from, to, u * u * (3 - 2 * u));
}
