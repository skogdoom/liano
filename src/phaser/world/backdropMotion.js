// Phaser-only scenery motion. The foreground keeps the gameplay camera; distant
// scenery follows it with continuous velocity instead of inheriting a catch's jerk.
export const PARALLAX_SPEED = 0.8;
const FREQUENCY = 24; // critically damped; about 83 ms of lag at a steady speed

export class BackdropMotion {
  constructor(x = 0) {
    this.reset(x);
  }

  reset(x) {
    this.x = this.prevX = x;
    this.velocity = 0;
  }

  mark() {
    this.prevX = this.x;
  }

  update(target, dt) {
    // Exact critically damped spring step for this target: stable at every step
    // size, with no overshoot of a stationary target and no per-frame speed reset.
    const offset = this.x - target;
    const rate = this.velocity + FREQUENCY * offset;
    const decay = Math.exp(-FREQUENCY * dt);
    this.x = target + (offset + rate * dt) * decay;
    this.velocity = (this.velocity - FREQUENCY * rate * dt) * decay;
  }
}
