import {
  BANANA_POINTS,
  BOOST_GRABS,
  START_GRIP,
  LIANA_SPACING,
  MONKEY_RADIUS,
  WORLD_HEIGHT,
  SIM_DT,
  GRAVITY,
  DEATH_BOUNCE,
  DEATH_POP,
} from '../config.js';
import { ballisticStep, closestPointOnSegment } from './physics.js';
import { createBanana, createObstacle, updateBananas, updateLianas, updateObstacles } from './generator.js';
import { Monkey, MonkeyState } from './monkey.js';
import { randomSeed } from './rng.js';
import { stageFor } from './stages.js';

// Lianas (keyed by index), obstacles and bananas (keyed by gap, null for none) are
// generated lazily around the monkeys. There are `players` monkeys, all starting on the
// first liana; each has its own score and scored gaps, and events carry its `player`
// index. `makeObstacle(seed, gap)` and `makeBanana(seed, gap, obstacle)` can be
// replaced in tests.
export class World {
  constructor({ seed = randomSeed(), makeObstacle = createObstacle, makeBanana = createBanana, players = 1 } = {}) {
    this.seed = seed;
    this.makeObstacle = (gap) => makeObstacle(seed, gap);
    this.makeBanana = (gap) => {
      const obstacle = this.obstacles.has(gap) ? this.obstacles.get(gap) : this.makeObstacle(gap);
      return makeBanana(seed, gap, obstacle);
    };
    this.lianas = new Map();
    this.obstacles = new Map();
    this.bananas = new Map();
    // Gaps whose banana was taken. Kept outside the bananas so culling cannot bring
    // one back.
    this.takenBananas = new Set();
    // Whole steps since the world was created; moving obstacles follow `time`.
    this.stepCount = 0;
    this.monkeys = Array.from({ length: players }, () => new Monkey());
    updateLianas(this.lianas, 0, null);
    updateObstacles(this.obstacles, 0, this.makeObstacle);
    updateBananas(this.bananas, 0, this.makeBanana);
    // The monkeys hang still (no slip) until the run starts.
    for (const monkey of this.monkeys) {
      monkey.slipping = false;
      monkey.grab(this.lianas.get(0), START_GRIP);
    }
    this.scores = this.monkeys.map(() => 0);
    // The stage each monkey has reached: that of the obstacle ahead of the furthest
    // liana it grabbed. Keyed on obstacle index, so points never change it.
    this.stages = this.monkeys.map(() => 1);
    // Gaps each monkey has scored. Kept outside the obstacles so culling cannot reset them.
    this.scoredGapsBy = this.monkeys.map(() => new Set());
    this.events = [];
  }

  // Player 1's monkey, score and scored gaps (the only ones in single player).
  get monkey() {
    return this.monkeys[0];
  }

  get score() {
    return this.scores[0];
  }

  get scoredGaps() {
    return this.scoredGapsBy[0];
  }

  // True while any monkey is alive.
  get alive() {
    return this.monkeys.some((m) => m.state !== MonkeyState.DEAD);
  }

  // World time (s), counted in whole steps so the solver can match it exactly.
  get time() {
    return this.stepCount * SIM_DT;
  }

  isAlive(player) {
    return this.monkeys[player].state !== MonkeyState.DEAD;
  }

  // Starts the run: from now on grips slip towards the tips.
  start() {
    for (const monkey of this.monkeys) if (monkey.liana) monkey.startSlipping();
  }

  // The action key while hanging. Returns false (and does nothing) while airborne.
  release(player = 0) {
    const liana = this.monkeys[player].release();
    if (!liana) return false;
    this.events.push({ type: 'release', liana: liana.index, player });
    return true;
  }

  step(dt) {
    this.stepCount++;
    // Once every monkey is dead they fall off-screen; keep the entities around the
    // camera as they are.
    const living = this.monkeys.filter((m) => m.state !== MonkeyState.DEAD);
    if (living.length > 0) {
      const xs = living.map((m) => m.x);
      const ahead = Math.max(...xs);
      const behind = Math.min(...xs);
      const held = living.map((m) => m.liana).filter(Boolean);
      updateLianas(this.lianas, ahead, held, behind);
      updateObstacles(this.obstacles, ahead, this.makeObstacle, behind);
      updateBananas(this.bananas, ahead, this.makeBanana, behind);
    }
    for (const obstacle of this.obstacles.values()) if (obstacle?.moving) obstacle.setTime(this.time);
    for (const liana of this.lianas.values()) liana.step(dt);

    this.monkeys.forEach((monkey, player) => {
      const wasAlive = monkey.state !== MonkeyState.DEAD;
      monkey.step(dt);
      if (!wasAlive) return;
      // An obstacle hit wins over a grab in the same step, and applies while hanging too.
      const hit = this.#hitsObstacle(monkey.x, monkey.y);
      if (hit) {
        this.#die(player, 'obstacle', hit.type);
        return;
      }
      this.#takeBanana(player);
      // At the tip the grip gives: a forced release, flying on with the current velocity.
      if (monkey.atTip) {
        const liana = monkey.release();
        this.events.push({ type: 'release', liana: liana.index, player, forced: true });
      }
      if (monkey.state === MonkeyState.AIRBORNE) this.#tryGrab(player);
      // Only falling out of the bottom ends the run; flying above the top does not.
      if (monkey.y > WORLD_HEIGHT + MONKEY_RADIUS) this.#die(player, 'fall');
    });
  }

  // A banana the monkey touches (hanging or flying) is taken: points, and the next
  // BOOST_GRABS grabs are boosted (a second banana starts the count again).
  #takeBanana(player) {
    const m = this.monkeys[player];
    for (const banana of this.bananas.values()) {
      if (!banana || this.takenBananas.has(banana.gap) || !banana.touches(m.x, m.y, MONKEY_RADIUS)) continue;
      this.takenBananas.add(banana.gap);
      m.boostGrabs = BOOST_GRABS;
      this.scores[player] += BANANA_POINTS;
      this.events.push({ type: 'banana', gap: banana.gap, score: this.scores[player], player });
    }
  }

  // The banana in `gap` if it is there to take.
  bananaAt(gap) {
    const banana = this.bananas.get(gap);
    return banana && !this.takenBananas.has(gap) ? banana : null;
  }

  // Returns and clears the events emitted since the last call.
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  // `obstacle` is the type of obstacle hit, for cause 'obstacle'.
  #die(player, cause, obstacle) {
    const m = this.monkeys[player];
    m.kill();
    if (cause === 'obstacle') {
      // Bounce off and pop up, then tumble down out of the screen.
      m.vx = -DEATH_BOUNCE * m.vx;
      m.vy = Math.min(m.vy, 0) - DEATH_POP;
    }
    this.events.push(obstacle ? { type: 'death', cause, obstacle, player } : { type: 'death', cause, player });
  }

  // Where the monkey would fly if released now (or where its current flight goes),
  // with the same rules as step(). For the debug overlay.
  predictFlight(maxSteps = 720, player = 0) {
    const m = this.monkeys[player];
    if (m.state === MonkeyState.DEAD) return { path: [], outcome: 'dead' };
    const excluded = m.state === MonkeyState.HANGING ? m.liana.index : m.excludedLiana?.index;
    const body = { x: m.x, y: m.y, vx: m.vx, vy: m.vy };
    const path = [{ x: body.x, y: body.y }];
    for (let i = 0; i < maxSteps; i++) {
      ballisticStep(body, SIM_DT, GRAVITY);
      path.push({ x: body.x, y: body.y });
      if (this.#hitsObstacle(body.x, body.y, this.time + (i + 1) * SIM_DT)) return { path, outcome: 'hit' };
      if (this.#grabCandidate(body.x, body.y, excluded)) return { path, outcome: 'grab' };
      if (body.y > WORLD_HEIGHT + MONKEY_RADIUS) return { path, outcome: 'fall' };
    }
    return { path, outcome: 'none' };
  }

  // The obstacle a monkey at (x, y) touches (at world time `time`, by default now), or null.
  #hitsObstacle(x, y, time = null) {
    for (const obstacle of this.obstacles.values()) {
      if (!obstacle) continue;
      const hit = time === null ? obstacle.hitsCircle(x, y, MONKEY_RADIUS) : obstacle.hitsCircleAt(time, x, y, MONKEY_RADIUS);
      if (hit) return obstacle;
    }
    return null;
  }

  // Reaching liana `to` forward from liana `from` scores the obstacle in every gap
  // between them (normally one; more if the monkey flew over lianas above the canopy).
  #score(player, from, to) {
    const scored = this.scoredGapsBy[player];
    for (let gap = from; gap < to; gap++) {
      if (scored.has(gap)) continue;
      const obstacle = this.obstacles.has(gap) ? this.obstacles.get(gap) : this.makeObstacle(gap);
      if (!obstacle) continue;
      scored.add(gap);
      this.scores[player]++;
      this.events.push({ type: 'score', gap, score: this.scores[player], player });
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

  #tryGrab(player) {
    const m = this.monkeys[player];
    const best = this.#grabCandidate(m.x, m.y, m.excludedLiana?.index);
    if (best) {
      const from = m.excludedLiana.index; // the liana released for this flight
      m.grab(best.liana, best.contactRadius);
      this.events.push({ type: 'grab', liana: best.liana.index, player });
      this.#score(player, from, best.liana.index);
      // The obstacle ahead of liana i is obstacle #i (in gap i).
      const stage = stageFor(best.liana.index).number;
      if (stage > this.stages[player]) {
        this.stages[player] = stage;
        this.events.push({ type: 'stage', stage, player });
      }
    }
  }
}
