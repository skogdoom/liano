import { Container, Graphics, Text } from 'pixi.js';
import { BANANA_RADIUS, MONKEY_RADIUS, SIM_DT, SWING_PERIOD } from '../config.js';
import { MonkeyState } from '../sim/monkey.js';
import { validReleaseSteps, longestRun, movingValidSteps } from '../sim/feasibility.js';


const COLORS = {
  lianaHitbox: 0xffe14d,
  obstacleHitbox: 0xff4dd2,
  monkeyHitbox: 0x4de1ff,
  valid: 0x5cff5c,
  invalid: 0xff5c5c,
  pathGrab: 0x5cff5c,
  pathMiss: 0xff8c42,
  forced: 0xffffff,
  banana: 0xffd23f,
};

// Toggled with D. Draws hitboxes, the flight the monkey would take if released now,
// and the valid release steps for the gap ahead of the current swing, from the grab
// (or the run start) up to the forced release at the tip.
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
    for (const banana of world.bananas.values()) {
      if (banana && world.bananaAt(banana.gap)) g.circle(banana.x, banana.y, BANANA_RADIUS);
    }
    g.stroke({ width: 2, color: COLORS.banana });
    // Moving obstacles: where they go over a period.
    for (const o of world.obstacles.values()) {
      if (!o?.moving) continue;
      const [first, ...rest] = o.pathPoints(60);
      g.moveTo(first.x, first.y);
      for (const p of rest) g.lineTo(p.x, p.y);
      g.closePath().stroke({ width: 1, color: COLORS.obstacleHitbox, alpha: 0.6 });
    }

    g.circle(monkey.x, monkey.y, MONKEY_RADIUS).stroke({ width: 2, color: COLORS.monkeyHitbox });

    const lines = [`${game.state}  stage ${game.stage}  score ${game.score}  lianas ${world.lianas.size}  obstacles ${world.obstacles.size}`];

    if (monkey.state === MonkeyState.HANGING && !monkey.slipping) {
      lines.push(`liana #${monkey.liana.index}  grip ${Math.round(monkey.gripRadius)}  no slip until the run starts`);
    } else if (monkey.state === MonkeyState.HANGING) {
      // Steps since the slip started (the grab, or the run start on the first liana),
      // and how far into the swing it started.
      const step = Math.round(monkey.gripTime / SIM_DT);
      const phase = Math.round(monkey.liana.swingTime / SIM_DT) - step;
      const w = this.#releaseWindow(world, monkey.gripFrom, phase, world.time - step * SIM_DT);
      w.positions.forEach((p, k) => {
        if (k < step) return;
        g.circle(p.x, p.y, w.valid[k] ? 3 : 2).fill(w.valid[k] ? COLORS.valid : COLORS.invalid);
      });
      const tip = w.positions[w.positions.length - 1];
      g.circle(tip.x, tip.y, MONKEY_RADIUS).stroke({ width: 2, color: COLORS.forced });
      const ms = (steps) => Math.round(steps * SIM_DT * 1000);
      const forcedIn = ((w.valid.length - 1 - step) * SIM_DT).toFixed(2);
      lines.push(
        `liana #${monkey.liana.index}  dir ${monkey.liana.swingDir > 0 ? '+' : '-'}  entry ${Math.round(monkey.gripFrom)}  grip ${Math.round(monkey.gripRadius)}  step ${step}  boost ${monkey.boostGrabs}${monkey.liana.period !== SWING_PERIOD ? ' (boosted swing)' : ''}`,
        `window ${w.run.length} steps (${ms(w.run.length)} ms) at ${w.run.start}-${w.run.start + w.run.length - 1}  now: ${w.valid[step] ? 'VALID' : 'invalid'}`,
        `forced release in ${forcedIn} s (step ${w.valid.length - 1})`,
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

  // Valid release steps for the actual entry, swing direction and phase, recomputed
  // per grab. A moving obstacle's window also depends on the world time at the grab.
  #releaseWindow(world, gripFrom, phase, grabTime) {
    const { liana } = world.monkey;
    const dir = liana.swingDir;
    const steps = Math.round(liana.period / SIM_DT);
    const phaseSteps = ((phase % steps) + steps) % steps;
    const key = `${liana.index}:${gripFrom}:${dir}:${phaseSteps}:${liana.period}`;
    if (this.cacheKey !== key || this.cacheWorld !== world) {
      const gap = dir > 0 ? liana.index : liana.index - 1;
      const obstacle = world.obstacles.get(gap) ?? null;
      const staticObstacle = obstacle?.moving ? null : obstacle;
      let { valid, positions } = validReleaseSteps(staticObstacle, gripFrom, liana.x, dir, phaseSteps, liana.period);
      if (obstacle?.moving && dir > 0 && phaseSteps === 0) {
        valid = movingValidSteps(obstacle.inGap(0), gripFrom, Math.round(grabTime / SIM_DT) * SIM_DT, liana.period);
      }
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
