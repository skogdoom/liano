import { HEART_GLINT, POP_FONT, POP_RISE, POP_TIME, bananaPose, bananaShape, popAlpha, popLook } from '../../views/banana.js';
import { makeText, setTextOrigin } from '../text.js';
import { makeContainer } from './build.js';

// The bananas (and hearts) still to take in the Phaser version, and the "+1" rising where
// one was taken (as the Pixi BananaViews): each a body piece with its glint, bobbing.
const BANANA_GLINT = bananaShape().glint;

export class BananaLayer {
  constructor(scene, art) {
    this.scene = scene;
    this.art = art;
    this.view = makeContainer(scene);
    this.entries = new Map(); // banana -> { view, glint, heart }
    this.pops = [];
    this.popPool = new Map();
    // Device pixels per unit, for the pop texts (see setTextResolution).
    this.textResolution = 1;
    this.setTextResolution(1);
  }

  // Text is rasterized at this many pixels per unit, to stay sharp on the screen.
  setTextResolution(resolution) {
    if (resolution === this.textResolution && this.popPool.size) return;
    this.textResolution = resolution;
    for (const texts of this.popPool.values()) for (const text of texts) text.destroy();
    this.popPool.clear();
    for (const heart of [false, true]) {
      const look = popLook(heart);
      const texts = Array.from({ length: 2 }, () => this.makePop(look).setVisible(false));
      this.popPool.set(look.text, texts);
    }
  }

  // `events` are the world events of this frame.
  update(world, events, dt, t = world.time) {
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
        const view = makeContainer(this.scene);
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
    for (const pop of this.pops.filter((p) => p.age >= POP_TIME)) {
      pop.text.setVisible(false);
      if (pop.text.style.resolution === this.textResolution) this.popPool.get(pop.text.text).push(pop.text);
      else pop.text.destroy();
    }
    this.pops = this.pops.filter((p) => p.age < POP_TIME);
  }

  // A pop's text at (x, y), centred.
  pop(look, x, y) {
    return (this.popPool.get(look.text)?.pop() ?? this.makePop(look)).setVisible(true).setAlpha(1).setPosition(x, y);
  }

  makePop(look) {
    const options = { family: POP_FONT.family, size: POP_FONT.size, weight: POP_FONT.weight, fill: look.fill, stroke: look.stroke, strokeWidth: POP_FONT.stroke, resolution: this.textResolution };
    const text = setTextOrigin(makeText(this.scene, look.text, options));
    this.view.add(text);
    return text;
  }
}
