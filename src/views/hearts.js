import { LIVES_2P } from '../config.js';

// Hearts: plain drawing and placement data. Colours, sizes, the drawing
// functions (the art pieces are generated from them),
// and where things go and how they move.

export const RED = 0xe8334a;
export const RED_DARK = 0x9c1f33;
export const SHINE = 0xffb3c0;
export const EMPTY = 0xf4e7c5;

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
