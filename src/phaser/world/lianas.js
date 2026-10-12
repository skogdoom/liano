import { LEAF_REFERENCE } from '../../art/pieces/liana.js';
import { drawnState, flashingLianas, leafLayout, lianaPlacement, lianaShape, lianaVisible } from '../../views/liana.js';
import { makeContainer } from './build.js';

// The lianas of one set in the Phaser version (PHASER_PLAN.md, M5a), in one colouring of
// the liana pieces: 'green', 'gold' (player 2's own in shared screen) or 'shadow'. Per
// liana the rope (a strip bent along it), its leaves and the lit end. The ropes, the
// leaves and the lit ends each go in a layer of their own, so the pieces of one kind are
// drawn together; a set's lianas are far enough apart not to overlap.
export class LianaSetRig {
  // `side`: for one of a pair of liana sets (shared screen), the side its lianas bow to
  // at rest; 0 for a single set.
  constructor(scene, art, colouring = 'green', side = 0) {
    this.scene = scene;
    this.art = art;
    this.side = side;
    this.keys = { rope: `liana.${colouring}.rope`, leaf: `liana.${colouring}.leaf` };
    this.view = makeContainer(scene);
    this.ropes = makeContainer(scene);
    this.leaves = makeContainer(scene);
    this.flashes = makeContainer(scene);
    this.view.add([this.ropes, this.leaves, this.flashes]);
    this.entries = new Map(); // liana -> entry
    this.leafUnit = art.unit(this.keys.leaf);
  }

  // The pieces for `liana`, made the first time it shows.
  entry(liana) {
    let entry = this.entries.get(liana);
    if (entry) return entry;
    const { scene, art } = this;
    const layout = leafLayout(liana.index, this.side);
    entry = {
      layout,
      rope: art.rope(scene, this.keys.rope),
      flash: art.rope(scene, 'liana.flash'),
      leaves: layout.leaves.map((leaf) => art.image(scene, this.keys.leaf, leaf.dark ? 1 : 0)),
      drawn: null,
    };
    this.ropes.add(entry.rope);
    this.flashes.add(entry.flash);
    this.leaves.add(entry.leaves);
    this.entries.set(liana, entry);
    return entry;
  }

  // Lays the pieces along `drawn` (a liana, or one standing upright at the origin),
  // placed at (x, y) and turned by `rotation`, the end lit or not.
  lay(entry, drawn, flash, { x = 0, y = 0, rotation = 0 } = {}) {
    const { points, leaves, flash: end } = lianaShape(drawn, entry.layout);
    this.art.bend(entry.rope, this.keys.rope, points);
    entry.flash.visible = flash;
    if (flash) this.art.bend(entry.flash, 'liana.flash', end);
    entry.leaves.forEach((image, i) => {
      image.setScale((this.leafUnit * leaves[i].length) / LEAF_REFERENCE);
      image.leaf = leaves[i];
    });
    this.place(entry, { x, y, rotation });
  }

  // Moves an entry's pieces to (x, y), turned by `rotation` about it.
  place(entry, { x, y, rotation }) {
    const [c, s] = [Math.cos(rotation), Math.sin(rotation)];
    for (const rope of [entry.rope, entry.flash]) rope.setPosition(x, y).setRotation(rotation);
    for (const image of entry.leaves) {
      const { leaf } = image;
      image.setPosition(x + leaf.x * c - leaf.y * s, y + leaf.x * s + leaf.y * c).setRotation(leaf.angle + rotation);
    }
  }

  setVisible(entry, visible) {
    entry.rope.visible = visible;
    if (!visible) entry.flash.visible = false;
    for (const image of entry.leaves) image.visible = visible;
  }

  setAlpha(entry, alpha) {
    for (const piece of [entry.rope, entry.flash, ...entry.leaves]) piece.setAlpha(alpha);
  }

  // As the Pixi LianaView: the lianas near the view, the ends lit where `monkeys` are
  // slipping off, swinging ones turned `alpha` of the way between sim steps.
  update(lianas, cameraX, viewWidth, monkeys = [], alpha = 1) {
    const seen = new Set();
    const flashing = flashingLianas(monkeys);
    for (const liana of lianas) {
      seen.add(liana);
      const entry = this.entry(liana);
      const visible = lianaVisible(liana, cameraX, viewWidth);
      this.setVisible(entry, visible);
      if (!visible) continue;
      const flash = flashing.has(liana);
      const state = drawnState(liana, flash);
      const place = lianaPlacement(liana, alpha);
      if (state === entry.drawn) {
        entry.flash.visible = flash;
        this.place(entry, place);
        continue;
      }
      this.lay(entry, place.drawn, flash, place);
      entry.drawn = state;
    }
    this.prune(seen);
  }

  // Drops the pieces of the lianas not in `seen`.
  prune(seen) {
    for (const [liana, entry] of this.entries) {
      if (seen.has(liana)) continue;
      for (const piece of [entry.rope, entry.flash, ...entry.leaves]) piece.destroy();
      this.entries.delete(liana);
    }
  }

  destroy() {
    this.view.destroy();
  }
}
