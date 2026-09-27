import { createBanana, createObstacle } from './sim/generator.js';
import { Banana } from './sim/banana.js';
import { Obstacle } from './sim/obstacle.js';
import { movingShareFor } from './sim/stages.js';

// Gaps past the furthest generated one to have ready.
export const PREFETCH_AHEAD = 5;
// Ready gaps this far behind the furthest generated one are dropped.
const KEEP_BEHIND = 20;

// Generates obstacles and bananas ahead of the world in a worker, so the solver does
// not run on the main thread. Generation is deterministic in (seed, gap), so the world
// gets the same level with or without the worker: a gap that is not ready yet (or any
// gap when there is no worker) is generated on the spot.
export class ObstaclePrefetch {
  // `worker` is a Worker running obstacleWorker.js, or null.
  constructor(worker = null) {
    this.worker = worker;
    this.seed = null;
    this.ready = new Map(); // gap -> { obstacle, banana } data (null for none)
    this.pending = new Set();
    // Gaps that may hold a moving obstacle, generated on the spot although the worker
    // was running (the first gaps of a world are static and generated at once).
    this.misses = 0;
    if (worker) {
      worker.onmessage = ({ data }) => this.#receive(data);
      worker.onerror = () => {
        this.worker = null;
      };
    }
    // For World({ makeObstacle, makeBanana }).
    this.makeObstacle = (seed, gap) => this.take(seed, gap);
    this.makeBanana = (seed, gap, obstacle) =>
      seed === this.seed && this.ready.has(gap)
        ? Banana.fromData(this.ready.get(gap).banana)
        : createBanana(seed, gap, obstacle);
  }

  // Starts over for a new world.
  reset(seed) {
    this.seed = seed;
    this.ready.clear();
    this.pending.clear();
  }

  // Asks the worker for the gaps after the furthest one in `obstacles` (a world's map,
  // or one per world when split screen's worlds share the seed).
  update(obstacles) {
    if (!this.worker || this.seed === null) return;
    const lasts = [];
    for (const map of [].concat(obstacles)) {
      let last = -Infinity;
      for (const gap of map.keys()) last = Math.max(last, gap);
      if (last !== -Infinity) lasts.push(last);
    }
    if (lasts.length === 0) return;
    for (const last of lasts) {
      for (let gap = last + 1; gap <= last + PREFETCH_AHEAD; gap++) {
        if (this.ready.has(gap) || this.pending.has(gap)) continue;
        this.pending.add(gap);
        this.worker.postMessage({ seed: this.seed, gap });
      }
    }
    const keepFrom = Math.min(...lasts) - KEEP_BEHIND;
    for (const gap of this.ready.keys()) if (gap < keepFrom) this.ready.delete(gap);
  }

  // The obstacle for (seed, gap): the worker's if it is ready, else generated now.
  take(seed, gap) {
    if (seed === this.seed && this.ready.has(gap)) return Obstacle.fromData(this.ready.get(gap).obstacle);
    if (this.worker && seed === this.seed && movingShareFor(gap) > 0) this.misses++;
    return createObstacle(seed, gap);
  }

  #receive({ seed, gap, obstacle, banana }) {
    if (seed !== this.seed) return;
    this.pending.delete(gap);
    this.ready.set(gap, { obstacle, banana });
  }
}
