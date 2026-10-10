import { MonkeyState } from './monkey.js';

// A recorded run of player 1's monkey, one frame per sim step, for the shadow monkey (see
// Game). A frame is what the monkey's view needs to draw it again: where it is, how it
// moves, whether it hangs, flies or is dead and, hanging, the liana's swing direction,
// angle and angular velocity.
const FIELDS = 8;
const STATES = [MonkeyState.HANGING, MonkeyState.AIRBORNE, MonkeyState.DEAD];

export class ShadowRun {
  constructor(settings = '') {
    // The settings (lives, slipping) of the run: a shadow only goes with runs under the same.
    this.settings = settings;
    this.data = new Float64Array(FIELDS * 1024);
    this.count = 0;
    this.score = 0;
  }

  // Records the monkey as it is after a step.
  add(monkey) {
    if ((this.count + 1) * FIELDS > this.data.length) {
      const bigger = new Float64Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    const liana = monkey.liana;
    const at = this.count * FIELDS;
    this.data.set(
      [
        monkey.x,
        monkey.y,
        monkey.vx,
        monkey.vy,
        STATES.indexOf(monkey.state),
        liana ? liana.swingDir : 1,
        liana ? liana.angle : 0,
        liana ? liana.angularVelocity : 0,
      ],
      at,
    );
    this.count++;
  }

  // Fills `out` (a monkey-like object for MonkeyView.update, see shadowMonkey) with frame
  // `index`, or returns null if the run has no such frame.
  frame(index, out) {
    if (index < 0 || index >= this.count) return null;
    const d = this.data;
    const at = index * FIELDS;
    out.x = d[at];
    out.y = d[at + 1];
    out.vx = d[at + 2];
    out.vy = d[at + 3];
    out.state = STATES[d[at + 4]];
    out.liana.swingDir = d[at + 5];
    out.liana.angle = d[at + 6];
    out.liana.angularVelocity = d[at + 7];
    return out;
  }
}

// An object that stands in for a monkey in MonkeyView.update, to be filled by frame().
export function shadowMonkey() {
  return { x: 0, y: 0, vx: 0, vy: 0, state: MonkeyState.AIRBORNE, liana: { swingDir: 1, angle: 0, angularVelocity: 0 } };
}
