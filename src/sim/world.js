import { GRIP_RADIUS, LIANA_SPACING, MONKEY_RADIUS, SCREEN_HEIGHT } from '../config.js';
import { closestPointOnSegment } from './physics.js';
import { updateLianas } from './generator.js';
import { Monkey, MonkeyState } from './monkey.js';

// Lianas are keyed by index and generated lazily around the monkey.
export class World {
  constructor() {
    this.lianas = new Map();
    this.monkey = new Monkey();
    updateLianas(this.lianas, 0, null);
    this.monkey.grab(this.lianas.get(0), GRIP_RADIUS);
    this.events = [];
  }

  get alive() {
    return this.monkey.state !== MonkeyState.DEAD;
  }

  // Space while hanging. Returns false (and does nothing) while airborne.
  release() {
    const liana = this.monkey.release();
    if (!liana) return false;
    this.events.push({ type: 'release', liana: liana.index });
    return true;
  }

  step(dt) {
    const { monkey } = this;
    updateLianas(this.lianas, monkey.x, monkey.liana);
    for (const liana of this.lianas.values()) liana.step(dt);
    monkey.step(dt);
    if (monkey.state === MonkeyState.AIRBORNE) this.#tryGrab();
    // Only falling out of the bottom ends the run; flying above the top does not.
    if (this.alive && monkey.y > SCREEN_HEIGHT + MONKEY_RADIUS) this.#die('fall');
  }

  // Returns and clears the events emitted since the last call.
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  #die(cause) {
    this.monkey.kill();
    this.events.push({ type: 'death', cause });
  }

  #tryGrab() {
    const m = this.monkey;
    const first = Math.ceil((m.x - MONKEY_RADIUS) / LIANA_SPACING);
    const last = Math.floor((m.x + MONKEY_RADIUS) / LIANA_SPACING);

    let best = null;
    let bestDistSq = MONKEY_RADIUS * MONKEY_RADIUS;
    for (let i = first; i <= last; i++) {
      const liana = this.lianas.get(i);
      if (!liana || !m.canGrab(liana)) continue;
      const p = closestPointOnSegment(m.x, m.y, liana.x, liana.anchorY, liana.x, liana.tipY);
      const distSq = (m.x - p.x) ** 2 + (m.y - p.y) ** 2;
      if (distSq <= bestDistSq) {
        best = { liana, contactRadius: p.t * liana.length };
        bestDistSq = distSq;
      }
    }

    if (best) {
      m.grab(best.liana, best.contactRadius);
      this.events.push({ type: 'grab', liana: best.liana.index });
    }
  }
}
