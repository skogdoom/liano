import { GRAVITY, MONKEY_RADIUS } from '../../config.js';
import { MAX_STEP_JUMP, MAX_STEP_TURN, blend } from '../../render/interpolate.js';
import { LianaState } from '../../sim/liana.js';
import { MonkeyState } from '../../sim/monkey.js';

const CATCH_TRANSITION_S = 0.08;
const MAX_CATCH_OFFSET = 2 * MONKEY_RADIUS;

// A Phaser-only snapshot of the quantities the shared views do not interpolate.
// Capture after EVERY simulation step, including frames with several steps. Drawing
// never writes to simulation objects, and a pause retains the same pair of samples.
export class WorldMotion {
  constructor(world) {
    this.world = world;
    this.previousTime = this.time = world.time;
    this.lianas = new WeakMap();
    this.monkeys = new WeakMap();
    this.capture();
  }

  capture() {
    const { world } = this;
    if (this.capturedTime === world.time) return;
    this.capturedTime = world.time;
    if (world.time !== this.time) {
      this.previousTime = this.time;
      this.time = world.time;
    }
    for (const set of world.lianaSets) for (const liana of set.values()) {
      let sample = this.lianas.get(liana);
      if (!sample) {
        sample = { velocity: liana.angularVelocity, previousVelocity: liana.angularVelocity, angle: liana.angle, state: liana.state, drawn: Object.create(liana) };
        this.lianas.set(liana, sample);
      }
      // A grab resets prevAngle: do not interpolate from the abandoned sway.
      const caught = liana.state === LianaState.SWINGING && sample.state !== LianaState.SWINGING;
      sample.previousVelocity = !caught && liana.prevAngle === sample.angle ? sample.velocity : liana.angularVelocity;
      sample.velocity = liana.angularVelocity;
      sample.angle = liana.angle;
      sample.state = liana.state;
    }
    for (const monkey of world.monkeys) {
      let sample = this.monkeys.get(monkey);
      if (!sample) {
        sample = { x: monkey.x, y: monkey.y, vx: monkey.vx, vy: monkey.vy,
          previousVx: monkey.vx, previousVy: monkey.vy, state: monkey.state,
          catch: null, drawn: Object.create(monkey) };
        this.monkeys.set(monkey, sample);
      }
      const caught = sample.state === MonkeyState.AIRBORNE && monkey.state === MonkeyState.HANGING;
      if (caught) {
        // Reconstruct the flight endpoint that grab() replaces with the grip.
        // Keep this drawing correction separate from collision/swing state.
        const dt = this.time - this.previousTime;
        const vy = sample.vy + GRAVITY * dt;
        const x = sample.x + sample.vx * dt - monkey.x;
        const y = sample.y + vy * dt - monkey.y;
        sample.catch = dt > 0 && Math.hypot(x, y) <= MAX_CATCH_OFFSET
          ? { time: this.time, x, y, vx: sample.vx, vy } : null;
      } else if (Math.hypot(monkey.x - sample.x, monkey.y - sample.y) > MAX_STEP_JUMP ||
        sample.state === MonkeyState.DEAD && monkey.state !== MonkeyState.DEAD) {
        // Respawns, teleports and new runs must not trail their old positions.
        sample.catch = null;
      }
      if (sample.catch && this.previousTime >= sample.catch.time + CATCH_TRANSITION_S) sample.catch = null;
      const same = sample.state === monkey.state;
      sample.previousVx = same ? sample.vx : monkey.vx;
      sample.previousVy = same ? sample.vy : monkey.vy;
      sample.vx = monkey.vx;
      sample.vy = monkey.vy;
      sample.x = monkey.x;
      sample.y = monkey.y;
      sample.state = monkey.state;
    }
  }

  at(alpha) {
    return this.previousTime + (this.time - this.previousTime) * alpha;
  }

  liana(liana, alpha) {
    const sample = this.lianas.get(liana);
    if (!sample) return liana;
    const drawn = sample.drawn;
    drawn.angle = drawn.prevAngle = blend(liana.prevAngle, liana.angle, alpha, MAX_STEP_TURN);
    drawn.angularVelocity = sample.previousVelocity + (sample.velocity - sample.previousVelocity) * alpha;
    return drawn;
  }

  monkey(monkey, alpha) {
    const sample = this.monkeys.get(monkey);
    if (!sample) return monkey;
    const drawn = sample.drawn;
    drawn.vx = sample.previousVx + (sample.vx - sample.previousVx) * alpha;
    drawn.vy = sample.previousVy + (sample.vy - sample.previousVy) * alpha;
    drawn.liana = monkey.liana ? this.liana(monkey.liana, alpha) : null;
    drawn.x = monkey.x;
    drawn.y = monkey.y;
    drawn.prevX = monkey.prevX;
    drawn.prevY = monkey.prevY;
    drawn.catchOffsetX = drawn.catchOffsetY = 0;
    if (sample.catch) {
      const elapsed = this.at(alpha) - sample.catch.time;
      const u = Math.max(0, Math.min(1, elapsed / CATCH_TRANSITION_S));
      const weight = 1 - u * u * (3 - 2 * u);
      let x = blend(monkey.prevX, monkey.x, alpha);
      let y = blend(monkey.prevY, monkey.y, alpha);
      const offsetX = sample.catch.x * weight;
      const offsetY = sample.catch.y * weight;
      // Before the catch's drawing time, finish the previous flight step.
      if (elapsed < 0) {
        x += sample.catch.vx * elapsed;
        y += sample.catch.vy * elapsed;
      }
      drawn.catchOffsetX = x + offsetX - blend(monkey.prevX, monkey.x, alpha);
      drawn.catchOffsetY = y + offsetY - blend(monkey.prevY, monkey.y, alpha);
      // Already sampled at alpha: MonkeyPose must not interpolate this again.
      drawn.x = drawn.prevX = x + offsetX;
      drawn.y = drawn.prevY = y + offsetY;
    }
    return drawn;
  }
}
