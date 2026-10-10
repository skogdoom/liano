import { ANCHOR_Y, LIANA_LENGTH, LIANA_SPACING } from '../config.js';
import { LianaState } from './liana.js';
import { MonkeyState } from './monkey.js';

// A recorded run of player 1's monkey, one frame per sim step, for the shadow monkey (see
// Game). A frame is what the views need to draw it again: where the monkey is, how it
// moves, whether it hangs, flies or is dead and, hanging, the liana's swing direction,
// angle and angular velocity; and the shadow's own lianas: the one it hangs on and the
// one it let go of, as long as that still sways (index, state, angle, angular velocity).
const FIELDS = 14;
const STATES = [MonkeyState.HANGING, MonkeyState.AIRBORNE, MonkeyState.DEAD];
const LIANA_STATES = [LianaState.IDLE, LianaState.SWINGING, LianaState.SETTLING];
const NONE = -1;

export class ShadowRun {
  constructor(settings = '') {
    // The settings (lives, slipping) of the run: a shadow only goes with runs under the same.
    this.settings = settings;
    this.data = new Float64Array(FIELDS * 1024);
    this.count = 0;
    this.score = 0;
    // The liana the monkey hangs on, and the one it let go of that still sways.
    this.held = null;
    this.released = null;
  }

  // Records the monkey as it is after a step.
  add(monkey) {
    if ((this.count + 1) * FIELDS > this.data.length) {
      const bigger = new Float64Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    // A liana the monkey left sways on until it settles.
    const liana = monkey.liana;
    if (this.held && this.held !== liana) this.released = this.held;
    this.held = liana;
    if (this.released && (this.released === liana || this.released.state === LianaState.IDLE)) this.released = null;
    const sway = this.released;
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
        liana ? liana.index : NONE,
        sway ? sway.index : NONE,
        sway ? LIANA_STATES.indexOf(sway.state) : 0,
        sway ? sway.angle : 0,
        sway ? sway.angularVelocity : 0,
        liana ? LIANA_STATES.indexOf(liana.state) : 0,
      ],
      this.count * FIELDS,
    );
    this.count++;
  }

  // Fills `out` (from shadowMonkey) with frame `index`, or returns null if the run has no
  // such frame.
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
    fillLiana(out.lianas[0], d[at + 8], d[at + 13], d[at + 6], d[at + 7]);
    fillLiana(out.lianas[1], d[at + 9], d[at + 10], d[at + 11], d[at + 12]);
    return out;
  }
}

function fillLiana(liana, index, state, angle, angularVelocity) {
  liana.active = index !== NONE;
  liana.index = index;
  liana.x = index * LIANA_SPACING;
  liana.state = LIANA_STATES[state];
  liana.angle = angle;
  liana.angularVelocity = angularVelocity;
}

const lianaProxy = () => ({
  active: false,
  index: 0,
  x: 0,
  anchorY: ANCHOR_Y,
  length: LIANA_LENGTH,
  state: LianaState.IDLE,
  angle: 0,
  angularVelocity: 0,
});

// An object that stands in for a monkey in MonkeyView.update, to be filled by frame(); it
// also has the two lianas the shadow draws, `lianas`: [the one held, the one let go of].
export function shadowMonkey() {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    state: MonkeyState.AIRBORNE,
    liana: { swingDir: 1, angle: 0, angularVelocity: 0 },
    lianas: [lianaProxy(), lianaProxy()],
  };
}
