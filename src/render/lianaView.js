import { Container, Graphics } from 'pixi.js';
import { SCREEN_WIDTH } from '../config.js';
import { LianaState } from '../sim/liana.js';
import { MAX_STEP_TURN, blend } from './interpolate.js';
import { LIANA_PALETTES, leafLayout, upright, tipFlashOn, drawLiana } from '../views/liana.js';

// The parts both versions share (pure: no Pixi) are in views/liana.js.
export * from '../views/liana.js';

// What a liana looks like right now; it is only redrawn when this changes. Resting
// lianas never change, and a swinging one is straight, so it is drawn once hanging
// straight down from the origin and turned about its anchor (see LianaView.update):
// only the lianas settling after a release redraw each frame.
function drawnState(liana, flash) {
  if (liana.state === LianaState.IDLE) return 'idle';
  if (liana.state === LianaState.SWINGING) return `swinging:${flash}`;
  return `${liana.state}:${liana.angle}:${liana.angularVelocity}:${flash}`;
}

// One Graphics per liana, kept while the liana exists and hidden when off-screen.
export class LianaView {
  // `palette`: one of LIANA_PALETTES. `side`: for one of a pair of liana sets (shared
  // screen), the side its lianas bow to at rest; 0 for a single set.
  constructor(palette = LIANA_PALETTES[0], side = 0) {
    this.palette = palette;
    this.side = side;
    this.view = new Container();
    this.entries = new Map(); // liana -> { g, layout, drawn }
    this.redraws = 0; // for tests and profiling
  }

  // `monkeys` light up the end of the liana they are slipping towards. `alpha`: how far
  // between the previous sim step and the current one to draw (see interpolate.js).
  update(lianas, cameraX, viewWidth = SCREEN_WIDTH, monkeys = [], alpha = 1) {
    const margin = 500;
    const seen = new Set();
    const flashing = new Set(monkeys.filter((m) => tipFlashOn(m.tipTime)).map((m) => m.liana));
    for (const liana of lianas) {
      seen.add(liana);
      let entry = this.entries.get(liana);
      if (!entry) {
        entry = { g: new Graphics(), layout: leafLayout(liana.index, this.side), drawn: null };
        this.entries.set(liana, entry);
        this.view.addChild(entry.g);
      }
      const visible = liana.x >= cameraX - margin && liana.x <= cameraX + viewWidth + margin;
      entry.g.visible = visible;
      if (!visible) continue;
      const flash = flashing.has(liana);
      const state = drawnState(liana, flash);
      // Swinging: only the turn changes each frame, about the anchor.
      if (liana.state === LianaState.SWINGING) entry.g.rotation = -blend(liana.prevAngle, liana.angle, alpha, MAX_STEP_TURN);
      if (state === entry.drawn) continue;
      if (liana.state === LianaState.SWINGING) {
        entry.g.position.set(liana.x, liana.anchorY);
        entry.g.rotation = -blend(liana.prevAngle, liana.angle, alpha, MAX_STEP_TURN);
        drawLiana(entry.g.clear(), upright(liana), entry.layout, flash, this.palette);
      } else {
        entry.g.position.set(0, 0);
        entry.g.rotation = 0;
        drawLiana(entry.g.clear(), liana, entry.layout, flash, this.palette);
      }
      entry.drawn = state;
      this.redraws++;
    }
    for (const [liana, entry] of this.entries) {
      if (seen.has(liana)) continue;
      entry.g.destroy();
      this.entries.delete(liana);
    }
  }
}
