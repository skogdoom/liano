import { BANANA_RADIUS, MONKEY_RADIUS, SIM_DT } from '../config.js';
import { MonkeyState } from '../sim/monkey.js';
import { validReleaseSteps, longestRun, movingValidSteps } from '../sim/feasibility.js';
import { heapMB } from '../render/fpsMeter.js';

// The debug view (D): plain drawing and placement data. Hitboxes, the flight
// the monkey would take if released now, and the valid release steps for the gap ahead
// of the current swing, from the grab (or the run start) up to the forced release at the
// tip; and the numbers. In split screen each pane gets its own, with its player's text at
// the top of the pane.

export const COLORS = {
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

export const DEBUG_TEXT = { family: 'monospace', size: 16, color: 0xffffff, lineHeight: 20 };
export const DEBUG_TEXT_X = 16;
const TEXT_TOP = 96; // below the mute button
const HEADER_LINES = 2;
export const HEADER_Y = TEXT_TOP;

// The lines every pane shares: the frame rate and times (`fps`, an FpsMeter) and the heap,
// the game's state and the sound's (`sound`, a sound player).
export function debugHeader(game, sound = null, fps = null) {
  const heap = heapMB();
  return [
    fps ? `${fps.describe()}${heap === null ? '' : `  heap ${heap.toFixed(0)} MB`}` : '',
    `${game.state}  stage ${game.stage}  score ${game.score}  slipping ${game.slip ? 'on' : 'off'} (G)${sound ? `  sound ${sound.details}` : ''}`,
  ].join('\n');
}

// Where pane `i`'s text goes (its layout `paneLayout`): the first pane's below the header,
// the others' at the top of their pane.
export const debugTextY = (i, paneLayout) => (i === 0 ? TEXT_TOP + HEADER_LINES * DEBUG_TEXT.lineHeight : (paneLayout?.y ?? 0) + 8);

// What the debug view draws for one world: its hitboxes and flight, in world
// coordinates, and its numbers. `g` is a Pixi Graphics, or anything with its drawing
// calls (the Phaser version records them and replays them on its own Graphics).
export class WorldDebug {
  constructor() {
    this.cacheKey = null;
    this.cacheWorld = null;
    this.window = null;
  }

  // Draws `world` on `g` (cleared first); returns the lines of text. `label` names the
  // player in split screen.
  update(g, world, label = null) {
    const { monkey } = world;
    g.clear();

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

    const lines = [`${label ? `${label}  ` : ''}lianas ${world.lianas.size}  obstacles ${world.obstacles.size}`];

    if (monkey.state === MonkeyState.HANGING) {
      const { liana } = monkey;
      const gap = liana.swingDir > 0 ? liana.index : liana.index - 1;
      const o = world.obstacles.get(gap);
      lines.push(o ? `obstacle #${gap}  ${o.type}  grade ${o.grade ?? '?'}` : `obstacle #${gap}  none`);
    }
    if (monkey.state === MonkeyState.HANGING && !monkey.slipping) {
      lines.push(`liana #${monkey.liana.index}  grip ${Math.round(monkey.gripRadius)}  no slip until the run starts`);
    } else if (monkey.state === MonkeyState.HANGING) {
      // Steps since the slip started (the grab, or the run start on the first liana),
      // and how far into the swing it started.
      const step = Math.round(monkey.gripTime / SIM_DT);
      const phase = Math.round(monkey.liana.swingTime / SIM_DT) - step;
      const w = this.#releaseWindow(world, monkey.gripFrom, phase, world.time - step * SIM_DT, monkey.holds);
      w.positions.forEach((p, k) => {
        if (k < step) return;
        g.circle(p.x, p.y, w.valid[k] ? 3 : 2).fill(w.valid[k] ? COLORS.valid : COLORS.invalid);
      });
      const tip = w.positions[w.positions.length - 1];
      g.circle(tip.x, tip.y, MONKEY_RADIUS).stroke({ width: 2, color: COLORS.forced });
      const ms = (steps) => Math.round(steps * SIM_DT * 1000);
      const forcedIn = ((w.valid.length - 1 - step) * SIM_DT).toFixed(2);
      lines.push(
        `liana #${monkey.liana.index}  dir ${monkey.liana.swingDir > 0 ? '+' : '-'}  entry ${Math.round(monkey.gripFrom)}  grip ${Math.round(monkey.gripRadius)}  step ${step}${monkey.holds ? '  held' : ''}`,
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
    return lines;
  }

  // Valid release steps for the actual entry, swing direction and phase, recomputed
  // per grab. A moving obstacle's window also depends on the world time at the grab.
  // `hold`: the grip is held (slipping off).
  #releaseWindow(world, gripFrom, phase, grabTime, hold) {
    const { liana } = world.monkey;
    const dir = liana.swingDir;
    const steps = Math.round(liana.period / SIM_DT);
    const phaseSteps = ((phase % steps) + steps) % steps;
    const key = `${liana.index}:${gripFrom}:${dir}:${phaseSteps}:${hold}`;
    if (this.cacheKey !== key || this.cacheWorld !== world) {
      const gap = dir > 0 ? liana.index : liana.index - 1;
      const obstacle = world.obstacles.get(gap) ?? null;
      const staticObstacle = obstacle?.moving ? null : obstacle;
      let { valid, positions } = validReleaseSteps(staticObstacle, gripFrom, liana.x, dir, phaseSteps, hold);
      if (obstacle?.moving && dir > 0 && phaseSteps === 0) {
        valid = movingValidSteps(obstacle.inGap(0), gripFrom, Math.round(grabTime / SIM_DT) * SIM_DT, hold);
      }
      this.window = { valid, positions, run: longestRun(valid) };
      this.cacheKey = key;
      this.cacheWorld = world;
    }
    return this.window;
  }
}
