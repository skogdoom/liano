import {
  GRIP_RADIUS,
  LIANA_SPACING,
  MONKEY_RADIUS,
  SCREEN_HEIGHT,
  SIM_DT,
  GRAVITY,
  DEATH_BOUNCE,
  DEATH_POP,
} from '../config.js';
import { ballisticStep, closestPointOnSegment } from './physics.js';
import { createObstacle, updateLianas, updateObstacles } from './generator.js';
import { Monkey, MonkeyState } from './monkey.js';
import { randomSeed } from './rng.js';

// Lianas (keyed by index) and obstacles (keyed by gap, null for empty gaps) are
// generated lazily around the monkey. `makeObstacle(seed, gap)` can be replaced in tests.
export class World {
  constructor({ seed = randomSeed(), makeObstacle = createObstacle } = {}) {
    this.seed = seed;
    this.makeObstacle = (gap) => makeObstacle(seed, gap);
    this.lianas = new Map();
    this.obstacles = new Map();
    this.monkey = new Monkey();
    updateLianas(this.lianas, 0, null);
    updateObstacles(this.obstacles, 0, this.makeObstacle);
    this.monkey.grab(this.lianas.get(0), GRIP_RADIUS);
    this.score = 0;
    // Gaps already scored. Kept outside the obstacles so culling cannot reset it.
    this.scoredGaps = new Set();
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
    // Once dead the monkey falls off-screen; keep the entities around the camera as they are.
    if (this.alive) {
      updateLianas(this.lianas, monkey.x, monkey.liana);
      updateObstacles(this.obstacles, monkey.x, this.makeObstacle);
    }
    for (const liana of this.lianas.values()) liana.step(dt);

    monkey.step(dt);
    if (!this.alive) return;

    // An obstacle hit wins over a grab in the same step, and applies while hanging too.
    const hit = this.#hitsObstacle(monkey.x, monkey.y);
    if (hit) {
      this.#die('obstacle', hit.type);
      return;
    }
    if (monkey.state === MonkeyState.AIRBORNE) this.#tryGrab();
    // Only falling out of the bottom ends the run; flying above the top does not.
    if (monkey.y > SCREEN_HEIGHT + MONKEY_RADIUS) this.#die('fall');
  }

  // Returns and clears the events emitted since the last call.
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  // `obstacle` is the type of obstacle hit, for cause 'obstacle'.
  #die(cause, obstacle) {
    const m = this.monkey;
    m.kill();
    if (cause === 'obstacle') {
      // Bounce off and pop up, then tumble down out of the screen.
      m.vx = -DEATH_BOUNCE * m.vx;
      m.vy = Math.min(m.vy, 0) - DEATH_POP;
    }
    this.events.push(obstacle ? { type: 'death', cause, obstacle } : { type: 'death', cause });
  }

  // Where the monkey would fly if released now (or where its current flight goes),
  // with the same rules as step(). For the debug overlay.
  predictFlight(maxSteps = 720) {
    const m = this.monkey;
    if (m.state === MonkeyState.DEAD) return { path: [], outcome: 'dead' };
    const excluded = m.state === MonkeyState.HANGING ? m.liana.index : m.excludedLiana?.index;
    const body = { x: m.x, y: m.y, vx: m.vx, vy: m.vy };
    const path = [{ x: body.x, y: body.y }];
    for (let i = 0; i < maxSteps; i++) {
      ballisticStep(body, SIM_DT, GRAVITY);
      path.push({ x: body.x, y: body.y });
      if (this.#hitsObstacle(body.x, body.y)) return { path, outcome: 'hit' };
      if (this.#grabCandidate(body.x, body.y, excluded)) return { path, outcome: 'grab' };
      if (body.y > SCREEN_HEIGHT + MONKEY_RADIUS) return { path, outcome: 'fall' };
    }
    return { path, outcome: 'none' };
  }

  // The obstacle a monkey at (x, y) touches, or null.
  #hitsObstacle(x, y) {
    for (const obstacle of this.obstacles.values()) {
      if (obstacle && obstacle.hitsCircle(x, y, MONKEY_RADIUS)) return obstacle;
    }
    return null;
  }

  // Reaching liana `to` forward from liana `from` scores the obstacle in every gap
  // between them (normally one; more if the monkey flew over lianas above the canopy).
  #score(from, to) {
    for (let gap = from; gap < to; gap++) {
      if (this.scoredGaps.has(gap)) continue;
      const obstacle = this.obstacles.has(gap) ? this.obstacles.get(gap) : this.makeObstacle(gap);
      if (!obstacle) continue;
      this.scoredGaps.add(gap);
      this.score++;
      this.events.push({ type: 'score', gap, score: this.score });
    }
  }

  // Closest liana touching a monkey at (x, y), other than `excludedIndex`. Compared by
  // index: lianas are regenerated as new objects after being culled.
  #grabCandidate(x, y, excludedIndex) {
    const first = Math.ceil((x - MONKEY_RADIUS) / LIANA_SPACING);
    const last = Math.floor((x + MONKEY_RADIUS) / LIANA_SPACING);
    let best = null;
    let bestDistSq = MONKEY_RADIUS * MONKEY_RADIUS;
    for (let i = first; i <= last; i++) {
      const liana = this.lianas.get(i);
      if (!liana || i === excludedIndex) continue;
      const p = closestPointOnSegment(x, y, liana.x, liana.anchorY, liana.x, liana.tipY);
      const distSq = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (distSq <= bestDistSq) {
        best = { liana, contactRadius: p.t * liana.length };
        bestDistSq = distSq;
      }
    }
    return best;
  }

  #tryGrab() {
    const m = this.monkey;
    const best = this.#grabCandidate(m.x, m.y, m.excludedLiana?.index);
    if (best) {
      const from = m.excludedLiana.index; // the liana released for this flight
      m.grab(best.liana, best.contactRadius);
      this.events.push({ type: 'grab', liana: best.liana.index });
      this.#score(from, best.liana.index);
    }
  }
}
