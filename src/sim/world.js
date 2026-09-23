import { GRIP_RADIUS, LIANA_SPACING, MONKEY_RADIUS } from '../config.js';
import { closestPointOnSegment } from './physics.js';
import { Liana } from './liana.js';
import { Monkey, MonkeyState } from './monkey.js';

// Fixed strip of lianas for now; lazy generation and culling replace this in milestone 3.
const FIRST_LIANA = -4;
const LAST_LIANA = 24;

export class World {
  constructor() {
    this.lianas = new Map();
    for (let i = FIRST_LIANA; i <= LAST_LIANA; i++) {
      this.lianas.set(i, new Liana(i, i * LIANA_SPACING));
    }
    this.monkey = new Monkey();
    this.monkey.grab(this.lianas.get(0), GRIP_RADIUS);
    this.events = [];
  }

  // Space while hanging. Returns false (and does nothing) while airborne.
  release() {
    const liana = this.monkey.release();
    if (!liana) return false;
    this.events.push({ type: 'release', liana: liana.index });
    return true;
  }

  step(dt) {
    for (const liana of this.lianas.values()) liana.step(dt);
    this.monkey.step(dt);
    if (this.monkey.state === MonkeyState.AIRBORNE) this.#tryGrab();
  }

  // Returns and clears the events emitted since the last call.
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
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
