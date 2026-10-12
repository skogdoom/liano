import { Container, Graphics, Text } from 'pixi.js';
import { drawHeart } from './heartView.js';
import { HEART_GLINT, POP_FONT, POP_RISE, POP_TIME, bananaPose, drawBanana, drawGlint, popAlpha, popLook } from '../views/banana.js';

// The parts both versions share (pure: no Pixi) are in views/banana.js.
export * from '../views/banana.js';

// The bananas still to take, bobbing gently and glinting (only drawn), and a "+1"
// rising where one was taken. A banana that the world turned into a heart is drawn as one.
export class BananaViews {
  constructor() {
    this.view = new Container();
    this.views = new Map(); // banana -> { view, glint, phase }
    this.pops = [];
  }

  // `events` are the world events of this frame.
  update(world, events, dt) {
    const t = world.time;
    const seen = new Set();
    for (const banana of world.bananas.values()) {
      if (!banana || !world.bananaAt(banana.gap)) continue;
      seen.add(banana);
      let entry = this.views.get(banana);
      // Turned into a heart since it was drawn.
      if (entry && entry.heart !== banana.heart) {
        entry.view.destroy({ children: true });
        this.views.delete(banana);
        entry = null;
      }
      if (!entry) {
        const view = new Container();
        const body = new Graphics();
        const spot = banana.heart ? HEART_GLINT : drawBanana(body);
        if (banana.heart) drawHeart(body, 17);
        const glint = new Graphics();
        drawGlint(glint, 8);
        glint.position.set(spot.x, spot.y);
        view.addChild(body, glint);
        entry = { view, glint, heart: banana.heart };
        this.views.set(banana, entry);
        this.view.addChild(view);
      }
      const pose = bananaPose(banana, t);
      entry.view.position.set(pose.x, pose.y);
      entry.view.rotation = pose.rotation;
      entry.glint.alpha = pose.glint;
    }
    for (const [banana, entry] of this.views) {
      if (seen.has(banana)) continue;
      entry.view.destroy({ children: true });
      this.views.delete(banana);
    }

    for (const e of events) {
      if (e.type !== 'banana' && e.type !== 'heart') continue;
      const banana = world.bananas.get(e.gap);
      if (!banana) continue;
      const look = popLook(e.type === 'heart');
      const text = new Text({
        text: look.text,
        style: {
          fontFamily: POP_FONT.family,
          fontSize: POP_FONT.size,
          fontWeight: POP_FONT.weight,
          fill: look.fill,
          // Round joins, as Phaser draws every text stroke (PHASER_PLAN.md, M5c).
          stroke: { color: look.stroke, width: POP_FONT.stroke, join: 'round' },
        },
      });
      text.anchor.set(0.5);
      text.position.set(banana.x, banana.y - 10);
      this.view.addChild(text);
      this.pops.push({ text, age: 0 });
    }
    for (const pop of this.pops) {
      pop.age += dt;
      pop.text.y -= POP_RISE * dt;
      pop.text.alpha = popAlpha(pop.age);
    }
    for (const pop of this.pops.filter((p) => p.age >= POP_TIME)) pop.text.destroy();
    this.pops = this.pops.filter((p) => p.age < POP_TIME);
  }
}
