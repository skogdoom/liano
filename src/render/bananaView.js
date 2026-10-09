import { Container, Graphics, Text } from 'pixi.js';
import { BANANA_RADIUS } from '../config.js';

const PEEL = 0xffd23f;
const RIDGE = 0xfff3a0;
const STEM = 0x6b5a2a;
const TIP = 0x5a3d1c;
const POP_TIME = 0.8; // s

// A banana `r` in size (about 2r long), centred on (0, 0): a curved body tapering to
// both ends, tilted, with a lighter ridge, a stem at one end and a dark tip at the other.
// Bananas are drawn a little larger than their hitbox, which with the monkey's makes
// pickups generous anyway.
export function drawBanana(g, r = BANANA_RADIUS * 1.4) {
  const radius = 1.25 * r; // of the arc along the middle of the banana
  const centreY = -0.95 * r;
  const tilt = -0.45;
  const [cos, sin] = [Math.cos(tilt), Math.sin(tilt)];
  // A point at angle `a` on the arc, `d` out from it, tilted.
  const at = (a, d, along = 0) => {
    const x = (radius + d) * Math.cos(a) + along * Math.sin(a);
    const y = centreY + (radius + d) * Math.sin(a) - along * Math.cos(a);
    return [x * cos - y * sin, x * sin + y * cos];
  };
  const from = Math.PI * 0.18;
  const to = Math.PI * 0.82;
  const n = 16;
  const outer = [];
  const inner = [];
  const ridge = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = from + (to - from) * t;
    const w = 0.42 * r * Math.sin(Math.PI * t) ** 0.6 + 0.03 * r;
    outer.push(at(a, w / 2));
    inner.unshift(at(a, -w / 2));
    ridge.push(at(a, w * 0.1));
  }
  // Centre the body's bounding box on (0, 0).
  const body = [...outer, ...inner];
  const xs = body.map(([x]) => x);
  const ys = body.map(([, y]) => y);
  const dx = -(Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = -(Math.min(...ys) + Math.max(...ys)) / 2;
  const flat = (points) => points.flatMap(([x, y]) => [x + dx, y + dy]);
  const stemWidth = 0.07 * r;
  const stemLength = 0.28 * r;
  const stem = [at(from, stemWidth), at(from, stemWidth, stemLength), at(from, -stemWidth, stemLength), at(from, -stemWidth)];
  g.poly(flat(stem)).fill(STEM);
  g.poly(flat(body)).fill(PEEL);
  const line = flat(ridge);
  g.moveTo(line[0], line[1]);
  for (let i = 2; i < line.length; i += 2) g.lineTo(line[i], line[i + 1]);
  g.stroke({ width: Math.max(0.06 * r, 1), color: RIDGE, alpha: 0.7, cap: 'round' });
  const [tipX, tipY] = at(to, 0);
  g.circle(tipX + dx, tipY + dy, 0.06 * r).fill(TIP);
}

// The bananas still to take, bobbing gently (the bob is only drawn), and a "+1"
// rising where one was taken.
export class BananaViews {
  constructor() {
    this.view = new Container();
    this.views = new Map(); // banana -> { view, phase }
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
        view.addChild(body);
        entry = { view, phase: banana.gap * 1.7 };
        this.views.set(banana, entry);
        this.view.addChild(view);
      }
      entry.view.position.set(banana.x, banana.y + 3 * Math.sin(t * 3 + entry.phase));
      entry.view.rotation = 0.15 * Math.sin(t * 2 + entry.phase);
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
        text: '+1',
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
