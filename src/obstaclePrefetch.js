import { createObstacle } from './sim/generator.js';
import { Obstacle } from './sim/obstacle.js';
import { movingShareFor } from './sim/stages.js';

// Gaps past the furthest generated one to have ready.
export const PREFETCH_AHEAD = 5;
// Ready gaps this far behind the furthest generated one are dropped.
const KEEP_BEHIND = 20;

// Generates obstacles ahead of the world in a worker, so the moving-obstacle solver does
// not run on the main thread. createObstacle is deterministic in (seed, gap), so the
// world gets the same level with or without the worker: a gap that is not ready yet
// (or any gap when there is no worker) is generated on the spot.
export class ObstaclePrefetch {
  // `worker` is a Worker running obstacleWorker.js, or null.
  constructor(worker = null) {
    this.worker = worker;
    this.seed = null;
    this.ready = new Map(); // gap -> obstacle data (null for an empty gap)
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
    // For World({ makeObstacle }).
    this.makeObstacle = (seed, gap) => this.take(seed, gap);
  }

  // Starts over for a new world.
  reset(seed) {
    this.seed = seed;
    this.ready.clear();
    this.pending.clear();
  }

  // Asks the worker for the gaps after the furthest one in `obstacles` (the world's map).
  update(obstacles) {
    if (!this.worker || this.seed === null) return;
    let last = -Infinity;
    for (const gap of obstacles.keys()) last = Math.max(last, gap);
    if (last === -Infinity) return;
    for (let gap = last + 1; gap <= last + PREFETCH_AHEAD; gap++) {
      if (this.ready.has(gap) || this.pending.has(gap)) continue;
      this.pending.add(gap);
      this.worker.postMessage({ seed: this.seed, gap });
    }
    for (const gap of this.ready.keys()) if (gap < last - KEEP_BEHIND) this.ready.delete(gap);
  }

  // The obstacle for (seed, gap): the worker's if it is ready, else generated now.
  take(seed, gap) {
    if (seed === this.seed && this.ready.has(gap)) return Obstacle.fromData(this.ready.get(gap));
    if (this.worker && seed === this.seed && movingShareFor(gap) > 0) this.misses++;
    return createObstacle(seed, gap);
  }

  #receive({ seed, gap, obstacle }) {
    if (seed !== this.seed) return;
    this.pending.delete(gap);
    this.ready.set(gap, obstacle);
  }
}
