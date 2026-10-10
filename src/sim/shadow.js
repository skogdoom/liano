import { LIANA_SPACING, SIM_DT } from '../config.js';
import { Liana } from './liana.js';
import { MonkeyState } from './monkey.js';

// A recorded run of player 1's monkey for the shadow monkey (see Game): a frame per sim
// step with where the monkey is, how it moves and whether it hangs, flies or is dead
// (all its view needs, apart from the liana it hangs on), and the few times it grabbed or
// let go of a liana. The liana it hangs on is not recorded: ShadowReplay swings it again
// from those events, with the same physics, so it swings exactly as it did.
const STATES = [MonkeyState.HANGING, MonkeyState.AIRBORNE, MonkeyState.DEAD];

export class ShadowRun {
  constructor(settings = '') {
    // The settings (lives, slipping) of the run: a shadow only goes with runs under the same.
    this.settings = settings;
    this.capacity = 1024;
    this.position = new Float64Array(2 * this.capacity); // x, y
    this.velocity = new Float32Array(2 * this.capacity); // vx, vy (only for facing and tilt)
    this.state = new Uint8Array(this.capacity);
    this.count = 0;
    this.score = 0;
    // { frame, index, dir }: the monkey grabs liana `index` (swinging in `dir`) in the step
    // after frame `frame`, or lets go of it (dir 0). Frame -1 is the grab the run starts with.
    this.events = [];
    this.held = null;
  }

  #grow() {
    this.capacity *= 2;
    for (const [name, Type, width] of [['position', Float64Array, 2], ['velocity', Float32Array, 2], ['state', Uint8Array, 1]]) {
      const bigger = new Type(width * this.capacity);
      bigger.set(this[name]);
      this[name] = bigger;
    }
  }

  // Records the monkey as it is after a step.
  add(monkey) {
    if (this.count === this.capacity) this.#grow();
    const liana = monkey.liana;
    if (liana !== this.held) {
      // The first liana was grabbed before the run's first step.
      const frame = this.count === 0 ? -1 : this.count;
      if (this.held) this.events.push({ frame, index: this.held.index, dir: 0 });
      if (liana) this.events.push({ frame, index: liana.index, dir: liana.swingDir });
      this.held = liana;
    }
    const at = this.count;
    this.position[2 * at] = monkey.x;
    this.position[2 * at + 1] = monkey.y;
    this.velocity[2 * at] = monkey.vx;
    this.velocity[2 * at + 1] = monkey.vy;
    this.state[at] = STATES.indexOf(monkey.state);
    this.count++;
  }

  // Fills `out` (from shadowMonkey) with frame `index`, or returns null if the run has no
  // such frame. The lianas are for ShadowReplay.
  frame(index, out) {
    if (index < 0 || index >= this.count) return null;
    out.x = this.position[2 * index];
    out.y = this.position[2 * index + 1];
    out.vx = this.velocity[2 * index];
    out.vy = this.velocity[2 * index + 1];
    out.state = STATES[this.state[index]];
    return out;
  }
}

// Swings the liana the shadow hangs on again from a run's events: `advanceTo(frame)` steps it
// (as the world steps its lianas, then the monkey grabs) up to frame `frame`. `held` is
// the liana the shadow hangs on, or null while it flies; `lianas` is the lianas to draw: just
// that one (a shadow liana only shows while the shadow swings on it).
export class ShadowReplay {
  constructor(run) {
    this.run = run;
    this.lianas = [];
    this.reset();
  }

  reset() {
    this.frame = -2;
    this.next = 0;
    this.held = null;
    this.advanceTo(-1);
  }

  // Applies the events of frame `frame`.
  #apply(frame) {
    const { events } = this.run;
    while (this.next < events.length && events[this.next].frame === frame) {
      const { index, dir } = events[this.next++];
      if (dir === 0) this.held = null;
      else {
        this.held = new Liana(index, index * LIANA_SPACING);
        this.held.grab(dir);
      }
    }
  }

  advanceTo(frame) {
    if (frame < this.frame) this.reset();
    if (this.frame === -2) this.#apply(-1);
    while (this.frame < frame) {
      this.frame++;
      if (this.frame < 0) continue;
      this.held?.step(SIM_DT);
      this.#apply(this.frame);
    }
    this.lianas.length = 0;
    if (this.held) this.lianas.push(this.held);
  }
}

// An object that stands in for a monkey in MonkeyView.update, to be filled by
// ShadowRun.frame; ShadowReplay then sets the liana it hangs on (`liana`) and the lianas to
// draw (`lianas`).
export function shadowMonkey() {
  return { x: 0, y: 0, vx: 0, vy: 0, state: MonkeyState.AIRBORNE, liana: null, lianas: [] };
}
