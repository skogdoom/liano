import { MAX_STEP_TURN, blend } from '../../render/interpolate.js';
import { LianaState } from '../../sim/liana.js';

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
        sample = { vx: monkey.vx, vy: monkey.vy, previousVx: monkey.vx, previousVy: monkey.vy, state: monkey.state, drawn: Object.create(monkey) };
        this.monkeys.set(monkey, sample);
      }
      const same = sample.state === monkey.state;
      sample.previousVx = same ? sample.vx : monkey.vx;
      sample.previousVy = same ? sample.vy : monkey.vy;
      sample.vx = monkey.vx;
      sample.vy = monkey.vy;
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
    return drawn;
  }
}
