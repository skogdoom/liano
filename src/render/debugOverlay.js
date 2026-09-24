import { Container, Graphics, Text } from 'pixi.js';
import { GRIP_RADIUS, MONKEY_RADIUS, SIM_DT, SWING_PERIOD } from '../config.js';
import { MonkeyState } from '../sim/monkey.js';
import { validReleaseSteps, longestRun, RELEASE_STEPS } from '../sim/feasibility.js';

const PERIOD_STEPS = Math.round(SWING_PERIOD / SIM_DT);

const COLORS = {
  lianaHitbox: 0xffe14d,
  obstacleHitbox: 0xff4dd2,
  monkeyHitbox: 0x4de1ff,
  valid: 0x5cff5c,
  invalid: 0xff5c5c,
  pathGrab: 0x5cff5c,
  pathMiss: 0xff8c42,
};

// Toggled with D. Draws hitboxes, the flight the monkey would take if released now,
// and the valid release steps for the gap ahead of the current swing.
export class DebugOverlay {
  constructor() {
    this.worldView = new Graphics(); // add to the camera-scrolled layer
    this.screenView = new Container();
    this.text = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 16, fill: 0xffffff, lineHeight: 20 },
    });
    this.text.position.set(16, 96); // below the mute button
    this.screenView.addChild(this.text);
    this.visible = false;
    this.#applyVisibility();
    this.cacheKey = null;
    this.window = null;
  }

  toggle() {
    this.visible = !this.visible;
    this.#applyVisibility();
  }

  update(game) {
    if (!this.visible) return;
    const { world } = game;
    const { monkey } = world;
    const g = this.worldView.clear();

    for (const liana of world.lianas.values()) g.moveTo(liana.x, liana.anchorY).lineTo(liana.x, liana.tipY);
    g.stroke({ width: 1, color: COLORS.lianaHitbox });

    for (const o of world.obstacles.values()) {
      if (!o) continue;
      for (const s of o.hitbox) {
        if (s.kind === 'rect') g.rect(o.x + s.dx, o.y + s.dy, s.w, s.h);
        else g.circle(o.x + s.dx, o.y + s.dy, s.r);
      }
    }
    g.stroke({ width: 2, color: COLORS.obstacleHitbox });

    g.circle(monkey.x, monkey.y, MONKEY_RADIUS).stroke({ width: 2, color: COLORS.monkeyHitbox });

    const lines = [`${game.state}  score ${game.score}  lianas ${world.lianas.size}  obstacles ${world.obstacles.size}`];

    if (monkey.state === MonkeyState.HANGING) {
      // The window comes round every period; after the first one the grip slide is over.
      const steps = Math.round(monkey.liana.swingTime / SIM_DT);
      const later = steps >= PERIOD_STEPS;
      const step = steps % PERIOD_STEPS;
      const w = this.#releaseWindow(world, later ? GRIP_RADIUS : monkey.gripFrom);
      w.positions.forEach((p, k) => {
        g.circle(p.x, p.y, w.valid[k] ? 3 : 2).fill(w.valid[k] ? COLORS.valid : COLORS.invalid);
      });
      const ms = Math.round(w.run.length * SIM_DT * 1000);
      const now = step <= RELEASE_STEPS ? (w.valid[step] ? 'VALID' : 'invalid') : 'past forward swing';
      lines.push(
        `liana #${monkey.liana.index}  dir ${monkey.liana.swingDir > 0 ? '+' : '-'}  grip from ${Math.round(monkey.gripFrom)}  phase step ${step}`,
        `window ${w.run.length} steps (${ms} ms) at ${w.run.start}-${w.run.start + w.run.length - 1}  now: ${now}`,
      );
    }

    const prediction = world.predictFlight();
    if (prediction.path.length > 1) {
      const [first, ...rest] = prediction.path;
      g.moveTo(first.x, first.y);
      for (const p of rest) g.lineTo(p.x, p.y);
      g.stroke({ width: 2, color: prediction.outcome === 'grab' ? COLORS.pathGrab : COLORS.pathMiss });
      lines.push(`${monkey.state === MonkeyState.HANGING ? 'release now' : 'flight'}: ${prediction.outcome}`);
    }

    this.text.text = lines.join('\n');
  }

  // Valid release steps for the actual grip and swing direction, recomputed per grab.
  #releaseWindow(world, gripFrom) {
    const { liana } = world.monkey;
    const dir = liana.swingDir;
    const key = `${liana.index}:${gripFrom}:${dir}`;
    if (this.cacheKey !== key || this.cacheWorld !== world) {
      const gap = dir > 0 ? liana.index : liana.index - 1;
      const { valid, positions } = validReleaseSteps(world.obstacles.get(gap) ?? null, gripFrom, liana.x, dir);
      this.window = { valid, positions, run: longestRun(valid) };
      this.cacheKey = key;
      this.cacheWorld = world;
    }
    return this.window;
  }

  #applyVisibility() {
    this.worldView.visible = this.visible;
    this.screenView.visible = this.visible;
  }
}
