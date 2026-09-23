import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../config.js';
import { mulberry32 } from '../sim/rng.js';
import { leafPoints, mixColor } from './shapes.js';

// Jungle backdrop: a fixed sky gradient, three parallax layers behind the world, and
// a canopy strip and floor band in front of it that scroll with the world.
//
// Layers are static geometry drawn once into a tile and shown as two copies, so a
// frame only moves containers. Colours are opaque: shapes near a tile edge are drawn
// again one tile to each side, and overlapping copies must look identical.

const TILE = 2048;
export const FLOOR_Y = SCREEN_HEIGHT - 60;
const CANOPY_BOTTOM = 34;

const SKY_TOP = 0x10261a;
const SKY_BOTTOM = 0x4a8060;

class ParallaxLayer {
  constructor(context, factor) {
    this.factor = factor;
    this.view = new Container();
    for (let i = 0; i < 2; i++) {
      const copy = new Graphics(context);
      copy.x = i * TILE;
      this.view.addChild(copy);
    }
  }

  update(cameraX) {
    const shift = (((cameraX * this.factor) % TILE) + TILE) % TILE;
    this.view.x = -shift;
  }
}

// Calls draw(x) for x and its wrapped positions one tile either side.
function wrapped(x, draw) {
  draw(x - TILE);
  draw(x);
  draw(x + TILE);
}

function sky() {
  const g = new Graphics();
  const bands = 32;
  const h = FLOOR_Y / bands;
  for (let i = 0; i < bands; i++) {
    g.rect(0, i * h, SCREEN_WIDTH, h + 1).fill(mixColor(SKY_TOP, SKY_BOTTOM, i / (bands - 1)));
  }
  return g.rect(0, FLOOR_Y, SCREEN_WIDTH, SCREEN_HEIGHT - FLOOR_Y).fill(SKY_BOTTOM);
}

// Far: hazy tree silhouettes and canopy masses.
function farLayer() {
  const ctx = new GraphicsContext();
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
  return new ParallaxLayer(ctx, 0.15);
}

// Mid: darker trunks with a few branch stubs.
function midLayer() {
  const ctx = new GraphicsContext();
  const rand = mulberry32(202);
  const trunk = 0x223d2b;
  for (let i = 0; i < 9; i++) {
    const x = rand() * TILE;
    const w = 34 + rand() * 30;
    const stubs = Array.from({ length: 2 }, () => ({ y: 180 + rand() * 300, side: rand() < 0.5 ? -1 : 1, len: 30 + rand() * 50 }));
    wrapped(x, (px) => {
      ctx.poly([px - w / 2, 0, px + w / 2, 0, px + w / 2 + 6, FLOOR_Y + 10, px - w / 2 - 6, FLOOR_Y + 10]).fill(trunk);
      for (const s of stubs) {
        const x0 = px + (s.side * w) / 2;
        ctx.poly([x0, s.y, x0 + s.side * s.len, s.y - 22, x0 + s.side * s.len, s.y - 14, x0, s.y + 12]).fill(trunk);
      }
    });
  }
  return new ParallaxLayer(ctx, 0.4);
}

// Near: ferns along the floor and leaf clumps under the canopy.
function nearLayer() {
  const ctx = new GraphicsContext();
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
  return new ParallaxLayer(ctx, 0.7);
}

// Front, moving with the world: the canopy strip the lianas hang from.
function canopyLayer() {
  const ctx = new GraphicsContext();
  const rand = mulberry32(404);
  const dark = 0x0f2517;
  const light = 0x1d4429;
  ctx.rect(-TILE, 0, 3 * TILE, CANOPY_BOTTOM - 8).fill(dark);
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
  return new ParallaxLayer(ctx, 1);
}

// Front, moving with the world: the dark jungle floor. Falling in here ends the run.
function floorLayer() {
  const ctx = new GraphicsContext();
  const rand = mulberry32(505);
  const floor = 0x0a140d;
  const growth = 0x0f1e14;
  ctx.rect(-TILE, FLOOR_Y, 3 * TILE, SCREEN_HEIGHT - FLOOR_Y).fill(floor);
  for (let x = 0; x < TILE; x += 10 + rand() * 16) {
    const h = 10 + rand() * 22;
    const lean = (rand() - 0.5) * 12;
    wrapped(x, (px) => ctx.poly([px - 5, FLOOR_Y + 4, px + lean, FLOOR_Y - h, px + 5, FLOOR_Y + 4]).fill(growth));
  }
  for (let x = 0; x < TILE; x += 40 + rand() * 60) {
    const r = 14 + rand() * 16;
    wrapped(x, (px) => ctx.circle(px, FLOOR_Y + 6, r).fill(growth));
  }
  return new ParallaxLayer(ctx, 1);
}

export class Background {
  constructor() {
    this.back = new Container();
    this.front = new Container();
    this.far = farLayer();
    this.mid = midLayer();
    this.near = nearLayer();
    this.canopy = canopyLayer();
    this.floor = floorLayer();
    this.back.addChild(sky(), this.far.view, this.mid.view, this.near.view);
    this.front.addChild(this.canopy.view, this.floor.view);
  }

  update(cameraX) {
    for (const layer of [this.far, this.mid, this.near, this.canopy, this.floor]) layer.update(cameraX);
  }
}
