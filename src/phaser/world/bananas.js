import { HEART_GLINT, POP_FONT, POP_RISE, POP_TIME, bananaPose, bananaShape, popAlpha, popLook } from '../../views/banana.js';
import { setTextOrigin, textStyle } from '../text.js';

// The bananas (and hearts) still to take in the Phaser version, and the "+1" rising where
// one was taken (as the Pixi BananaViews): each a body piece with its glint, bobbing.
const BANANA_GLINT = bananaShape().glint;

export class BananaLayer {
  constructor(scene, art) {
    this.scene = scene;
    this.art = art;
    this.view = scene.make.container({}, false);
    this.entries = new Map(); // banana -> { view, glint, heart }
    this.pops = [];
    // Device pixels per unit, for the pop texts (see setTextResolution).
    this.textResolution = 1;
  }

  // Text is rasterized at this many pixels per unit, to stay sharp on the screen.
  setTextResolution(resolution) {
    this.textResolution = resolution;
  }

  // `events` are the world events of this frame.
  update(world, events, dt) {
    const t = world.time;
    const seen = new Set();
    for (const banana of world.bananas.values()) {
      if (!banana || !world.bananaAt(banana.gap)) continue;
      seen.add(banana);
      let entry = this.entries.get(banana);
      // Turned into a heart since it was drawn.
      if (entry && entry.heart !== banana.heart) {
        entry.view.destroy();
        this.entries.delete(banana);
        entry = null;
      }
      if (!entry) {
        const spot = banana.heart ? HEART_GLINT : BANANA_GLINT;
        const view = this.scene.make.container({}, false);
        const glint = this.art.image(this.scene, 'banana.glint').setPosition(spot.x, spot.y);
        view.add([this.art.image(this.scene, banana.heart ? 'heart.field' : 'banana.body'), glint]);
        entry = { view, glint, heart: banana.heart };
        this.entries.set(banana, entry);
        this.view.add(view);
      }
      const pose = bananaPose(banana, t);
      entry.view.setPosition(pose.x, pose.y).setRotation(pose.rotation);
      entry.glint.setAlpha(pose.glint);
    }
    for (const [banana, entry] of this.entries) {
      if (seen.has(banana)) continue;
      entry.view.destroy();
      this.entries.delete(banana);
    }

    for (const e of events) {
      if (e.type !== 'banana' && e.type !== 'heart') continue;
      const banana = world.bananas.get(e.gap);
      if (!banana) continue;
      this.pops.push({ text: this.pop(popLook(e.type === 'heart'), banana.x, banana.y - 10), age: 0 });
    }
    for (const pop of this.pops) {
      pop.age += dt;
      pop.text.y -= POP_RISE * dt;
      pop.text.setAlpha(popAlpha(pop.age));
    }
    for (const pop of this.pops.filter((p) => p.age >= POP_TIME)) pop.text.destroy();
    this.pops = this.pops.filter((p) => p.age < POP_TIME);
  }

  // A pop's text at (x, y), centred.
  pop(look, x, y) {
    const style = textStyle({ family: POP_FONT.family, size: POP_FONT.size, weight: POP_FONT.weight, fill: look.fill, stroke: look.stroke, strokeWidth: POP_FONT.stroke, resolution: this.textResolution });
    const text = setTextOrigin(this.scene.make.text({ x, y, text: look.text, style }, false));
    this.view.add(text);
    return text;
  }
}
