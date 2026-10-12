import { Container, Graphics, Text } from 'pixi.js';
import { drawHeart } from './heartView.js';
import { PEEL, TIP, POP_TIME, drawBanana, HEART_GLINT, drawGlint, HEART_POP, HEART_POP_EDGE } from '../views/banana.js';

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
        entry = { view, glint, phase: banana.gap * 1.7, heart: banana.heart };
        this.views.set(banana, entry);
        this.view.addChild(view);
      }
      entry.view.position.set(banana.x, banana.y + 3 * Math.sin(t * 3 + entry.phase));
      entry.view.rotation = 0.15 * Math.sin(t * 2 + entry.phase);
      // It fades in and out over half of every 1.6 s.
      entry.glint.alpha = Math.max(0, Math.sin(t * 4 + entry.phase));
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
      const heart = e.type === 'heart';
      const text = new Text({
        text: heart ? '+1 ♥' : '+1',
        style: {
          fontFamily: 'sans-serif',
          fontSize: 26,
          fontWeight: 'bold',
          fill: heart ? HEART_POP : PEEL,
          stroke: { color: heart ? HEART_POP_EDGE : TIP, width: 4 },
        },
      });
      text.anchor.set(0.5);
      text.position.set(banana.x, banana.y - 10);
      this.view.addChild(text);
      this.pops.push({ text, age: 0 });
    }
    for (const pop of this.pops) {
      pop.age += dt;
      pop.text.y -= 40 * dt;
      pop.text.alpha = Math.max(0, 1 - pop.age / POP_TIME);
    }
    for (const pop of this.pops.filter((p) => p.age >= POP_TIME)) pop.text.destroy();
    this.pops = this.pops.filter((p) => p.age < POP_TIME);
  }
}
