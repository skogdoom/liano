import { GRIP_RADIUS, LIANA_SPACING, MONKEY_RADIUS, SCREEN_HEIGHT } from '../config.js';
import { closestPointOnSegment } from './physics.js';
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

    const prevX = monkey.x;
    monkey.step(dt);
    if (!this.alive) return;

    // An obstacle hit wins over a grab in the same step, and applies while hanging too.
    if (this.#hitsObstacle()) {
      this.#die('obstacle');
      return;
    }
    if (monkey.state === MonkeyState.AIRBORNE) this.#tryGrab();
    this.#score(prevX, monkey.x);
    // Only falling out of the bottom ends the run; flying above the top does not.
    if (monkey.y > SCREEN_HEIGHT + MONKEY_RADIUS) this.#die('fall');
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

  #hitsObstacle() {
    const { x, y } = this.monkey;
    for (const obstacle of this.obstacles.values()) {
      if (obstacle && obstacle.hitsCircle(x, y, MONKEY_RADIUS)) return true;
    }
    return false;
  }

  // +1 the first time the monkey's x moves past an obstacle's right edge.
  #score(prevX, x) {
    for (const obstacle of this.obstacles.values()) {
      if (!obstacle || this.scoredGaps.has(obstacle.gap)) continue;
      if (prevX <= obstacle.right && x > obstacle.right) {
        this.scoredGaps.add(obstacle.gap);
        this.score++;
        this.events.push({ type: 'score', gap: obstacle.gap, score: this.score });
      }
    }
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
