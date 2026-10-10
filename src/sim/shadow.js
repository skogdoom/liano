import { GRAVITY, LIANA_SPACING, MONKEY_RADIUS, SIM_DT, WORLD_HEIGHT } from '../config.js';
import { Liana } from './liana.js';
import { MonkeyState } from './monkey.js';

// A recorded run of player 1's monkey for the shadow monkey (see Game): a frame per sim
// step with where the monkey is, how it moves and whether it hangs, flies or is dead
// (all its view needs, apart from the liana it hangs on), and the few times it grabbed or
// let go of a liana. The lianas it hangs on are not recorded: ShadowReplay swings them again
// from those events, with the same physics, so they swing exactly as they did.
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

  // The run is over: the monkey lets go of what it hangs on (a run ended with Esc while
  // hanging), so the shadow's liana fades out as the shadow falls.
  finish() {
    if (this.held) this.events.push({ frame: this.count, index: this.held.index, dir: 0 });
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

  // Fills `out` (from shadowMonkey) with frame `index`, or returns null if there is none: a
  // run ends when the game is over, but the shadow does not vanish from the screen then: from
  // the last frame on it falls (tumbling, as a monkey does that was lost) until it is below
  // the world, which is where it leaves the screen. The lianas are for ShadowReplay.
  frame(index, out) {
    if (index < 0) return null;
    if (index >= this.count) return this.#fall(index, out);
    out.x = this.position[2 * index];
    out.y = this.position[2 * index + 1];
    out.vx = this.velocity[2 * index];
    out.vy = this.velocity[2 * index + 1];
    out.state = STATES[this.state[index]];
    return out;
  }

  // The frame `index` after the run's last: ballistic from where it ended, tumbling.
  #fall(index, out) {
    if (this.count === 0) return null;
    const last = this.count - 1;
    const t = (index - last) * SIM_DT;
    const vy = this.velocity[2 * last + 1] + GRAVITY * t;
    const y = this.position[2 * last + 1] + this.velocity[2 * last + 1] * t + 0.5 * GRAVITY * t * t;
    if (y > WORLD_HEIGHT + MONKEY_RADIUS) return null;
    out.x = this.position[2 * last] + this.velocity[2 * last] * t;
    out.y = y;
    out.vx = this.velocity[2 * last];
    out.vy = vy;
    out.state = MonkeyState.DEAD;
    return out;
  }
}

// How long (s) a shadow liana fades in before the shadow monkey grabs it, and out after it
// lets go.
export const SHADOW_LIANA_FADE = 0.4;
const FADE_STEPS = Math.round(SHADOW_LIANA_FADE / SIM_DT);

// Swings the lianas the shadow hangs on again from a run's events: `advanceTo(frame)` steps
// them (as the world steps its lianas, then the monkey grabs) up to frame `frame`. `held` is
// the liana the shadow hangs on, or null while it flies. `lianas` is what to draw, as
// { liana, alpha }: the held one (alpha 1), the next one it will grab, at rest, fading in
// for the last SHADOW_LIANA_FADE s before the grab, and those it let go of, swaying
// back to rest, fading out for SHADOW_LIANA_FADE s after.
export class ShadowReplay {
  constructor(run) {
    this.run = run;
    this.lianas = [];
    this.rest = new Map(); // index -> a liana at rest, for those fading in
    this.reset();
  }

  reset() {
    this.frame = -2;
    this.next = 0;
    this.held = null;
    this.released = []; // { liana, since }
    this.advanceTo(-1);
  }

  // Applies the events of frame `frame`.
  #apply(frame) {
    const { events } = this.run;
    while (this.next < events.length && events[this.next].frame === frame) {
      const { index, dir } = events[this.next++];
      if (dir === 0) {
        if (this.held) {
          this.held.release();
          this.released.push({ liana: this.held, since: frame });
        }
        this.held = null;
      } else {
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
      for (const { liana } of this.released) liana.step(SIM_DT);
      this.#apply(this.frame);
    }
    this.released = this.released.filter(({ since }) => frame - since < FADE_STEPS);
    this.lianas.length = 0;
    for (const { liana, since } of this.released) this.lianas.push({ liana, alpha: 1 - (frame - since) / FADE_STEPS });
    // The ones about to be grabbed.
    const { events } = this.run;
    for (let i = this.next; i < events.length && events[i].frame - frame <= FADE_STEPS; i++) {
      const { index, dir, frame: at } = events[i];
      if (dir === 0 || at <= frame) continue;
      if (!this.rest.has(index)) this.rest.set(index, new Liana(index, index * LIANA_SPACING));
      this.lianas.push({ liana: this.rest.get(index), alpha: 1 - (at - frame) / FADE_STEPS });
    }
    if (this.held) this.lianas.push({ liana: this.held, alpha: 1 });
  }
}

// An object that stands in for a monkey in MonkeyView.update, to be filled by
// ShadowRun.frame; ShadowReplay then sets the liana it hangs on (`liana`) and the lianas to
// draw (`lianas`).
export function shadowMonkey() {
  return { x: 0, y: 0, vx: 0, vy: 0, state: MonkeyState.AIRBORNE, liana: null, lianas: [] };
}
