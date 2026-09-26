import { Container, Graphics, Text } from 'pixi.js';
import { BANANA_POINTS, BANANA_RADIUS } from '../config.js';

const PEEL = 0xffd23f;
const PEEL_SHADE = 0xe0a91f;
const TIP = 0x5a3d1c;
const SPARKLE = 0xffffff;
const POP_TIME = 0.8; // s

// A yellow crescent `r` in radius, centred on (0, 0). Bananas are drawn a little larger
// than their hitbox, which with the monkey's makes pickups generous anyway.
function drawBanana(g, r = BANANA_RADIUS * 1.4) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 12));
    outer.push(r * Math.cos(a), r * Math.sin(a) - r * 0.63);
    inner.push(r * 0.72 * Math.cos(a), r * 0.55 * Math.sin(a) - r * 0.63);
  }
  const pts = [...outer];
  for (let i = inner.length - 2; i >= 0; i -= 2) pts.push(inner[i], inner[i + 1]);
  g.poly(pts).fill(PEEL);
  g.poly(pts.slice(outer.length / 2)).fill({ color: PEEL_SHADE, alpha: 0.6 });
  g.circle(outer[0], outer[1], r * 0.14).fill(TIP);
  g.circle(outer[outer.length - 2], outer[outer.length - 1], r * 0.14).fill(TIP);
}

// A four-pointed glint.
function drawSparkle(g, size) {
  g.poly([0, -size, size * 0.25, -size * 0.25, size, 0, size * 0.25, size * 0.25, 0, size, -size * 0.25, size * 0.25, -size, 0, -size * 0.25, -size * 0.25]).fill(SPARKLE);
}

// The bananas still to take, bobbing and glinting (the bob is only drawn), and a "+3"
// rising where one was taken.
export class BananaViews {
  constructor() {
    this.view = new Container();
    this.views = new Map(); // banana -> { view, sparkle }
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
      if (!entry) {
        const view = new Container();
        const body = new Graphics();
        drawBanana(body);
        const sparkle = new Graphics();
        drawSparkle(sparkle, 5);
        sparkle.position.set(BANANA_RADIUS * 0.6, -BANANA_RADIUS * 0.9);
        view.addChild(body, sparkle);
        entry = { view, sparkle, phase: banana.gap * 1.7 };
        this.views.set(banana, entry);
        this.view.addChild(view);
      }
      entry.view.position.set(banana.x, banana.y + 3 * Math.sin(t * 3 + entry.phase));
      entry.view.rotation = 0.15 * Math.sin(t * 2 + entry.phase);
      entry.sparkle.alpha = Math.max(0, Math.sin(t * 4 + entry.phase));
    }
    for (const [banana, entry] of this.views) {
      if (seen.has(banana)) continue;
      entry.view.destroy({ children: true });
      this.views.delete(banana);
    }

    for (const e of events) {
      if (e.type !== 'banana') continue;
      const banana = world.bananas.get(e.gap);
      if (!banana) continue;
      const text = new Text({
        text: `+${BANANA_POINTS}`,
        style: { fontFamily: 'sans-serif', fontSize: 26, fontWeight: 'bold', fill: PEEL, stroke: { color: TIP, width: 4 } },
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

// Over the monkey while boosted: a banana and the boosted grabs left.
export class BoostBadge {
  constructor() {
    this.view = new Container();
    const icon = new Graphics();
    drawBanana(icon, 10);
    icon.x = -12;
    this.count = new Text({
      text: '',
      style: { fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', fill: PEEL, stroke: { color: TIP, width: 3 } },
    });
    this.count.anchor.set(0, 0.5);
    this.count.position.set(2, -3);
    this.view.addChild(icon, this.count);
    this.view.visible = false;
  }

  update(monkey) {
    const grabs = monkey.state === 'DEAD' ? 0 : monkey.boostGrabs;
    this.view.visible = grabs > 0;
    if (!this.view.visible) return;
    this.count.text = `×${grabs}`;
    this.view.position.set(monkey.x, monkey.y - 48);
  }
}
