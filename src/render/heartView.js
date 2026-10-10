import { Container, Graphics, Text } from 'pixi.js';
import { LIVES_2P } from '../config.js';

const RED = 0xe8334a;
const RED_DARK = 0x9c1f33;
const SHINE = 0xffb3c0;
const EMPTY = 0xf4e7c5;

// A heart `r` across, centred on (0, 0): two lobes and a point. Filled, with a shine, or
// as an outline for a life that was lost.
export function drawHeart(g, r = 12, filled = true) {
  const w = r;
  const top = -0.55 * r;
  const path = [
    [0, 0.85 * r],
    [-1.05 * w, 0.05 * r],
    [-1.0 * w, -0.5 * r],
    [-0.55 * w, top - 0.2 * r],
    [0, -0.25 * r],
    [0.55 * w, top - 0.2 * r],
    [1.0 * w, -0.5 * r],
    [1.05 * w, 0.05 * r],
  ];
  const flat = path.flat();
  if (filled) {
    g.poly(flat).fill(RED).stroke({ width: Math.max(r * 0.12, 1), color: RED_DARK, join: 'round' });
    g.ellipse(-0.45 * w, -0.35 * r, 0.22 * w, 0.13 * r).fill({ color: SHINE, alpha: 0.85 });
  } else {
    g.poly(flat).stroke({ width: Math.max(r * 0.14, 1.2), color: EMPTY, alpha: 0.55, join: 'round' });
  }
}

// How the hearts of a player show: up to MAX_SHOWN of them, filled for the lives left and
// outlined for the ones lost (up to LIVES_2P of them, the lives everyone starts with);
// with more lives than that, MAX_SHOWN filled ones and the count in a small number at the
// top left of the leftmost.
export const MAX_SHOWN = 5;

// The hearts to draw for `lives`: how many are filled and how many are outlines, and
// the number to write on the leftmost (0 for none).
export function heartsFor(lives, slots = LIVES_2P) {
  const filled = Math.min(lives, MAX_SHOWN);
  const empty = lives > MAX_SHOWN ? 0 : Math.max(Math.min(slots, MAX_SHOWN) - filled, 0);
  return { filled, empty, count: lives > MAX_SHOWN ? lives : 0 };
}

// A row of hearts, right-aligned at its position.
export class HeartRow {
  constructor(size = 11) {
    this.size = size;
    this.view = new Container();
    this.hearts = new Container();
    this.count = new Text({
      text: '',
      style: {
        fontFamily: 'sans-serif',
        fontSize: Math.round(size * 1.05),
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: RED_DARK, width: 3 },
      },
    });
    this.count.anchor.set(0.5);
    this.view.addChild(this.hearts, this.count);
    this.shown = null;
  }

  update(lives) {
    if (lives === this.shown) return;
    this.shown = lives;
    const { filled, empty, count } = heartsFor(lives);
    const spacing = this.size * 2.3;
    const total = filled + empty;
    for (const old of this.hearts.removeChildren()) old.destroy();
    for (let i = 0; i < total; i++) {
      const x = -(total - 1 - i) * spacing;
      const heart = new Graphics();
      drawHeart(heart, this.size, i < filled);
      heart.position.set(x, 0);
      this.hearts.addChild(heart);
    }
    this.count.visible = count > 0;
    if (count > 0) {
      this.count.text = String(count);
      // At the top left corner of the leftmost heart.
      this.count.position.set(-(total - 1) * spacing - this.size * 0.95, -this.size * 0.85);
    }
  }
}
