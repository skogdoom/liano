import { Container, Graphics } from 'pixi.js';
import { SCREEN_WIDTH } from '../config.js';
import { LIANA_PALETTES, drawLiana, drawnState, flashingLianas, leafLayout, lianaPlacement, lianaVisible } from '../views/liana.js';

// The parts both versions share (pure: no Pixi) are in views/liana.js.
export * from '../views/liana.js';

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
    const seen = new Set();
    const flashing = flashingLianas(monkeys);
    for (const liana of lianas) {
      seen.add(liana);
      let entry = this.entries.get(liana);
      if (!entry) {
        entry = { g: new Graphics(), layout: leafLayout(liana.index, this.side), drawn: null };
        this.entries.set(liana, entry);
        this.view.addChild(entry.g);
      }
      const visible = lianaVisible(liana, cameraX, viewWidth);
      entry.g.visible = visible;
      if (!visible) continue;
      const flash = flashing.has(liana);
      const state = drawnState(liana, flash);
      const place = lianaPlacement(liana, alpha);
      // Swinging: only the turn changes each frame, about the anchor.
      entry.g.rotation = place.rotation;
      if (state === entry.drawn) continue;
      entry.g.position.set(place.x, place.y);
      drawLiana(entry.g.clear(), place.drawn, entry.layout, flash, this.palette);
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
