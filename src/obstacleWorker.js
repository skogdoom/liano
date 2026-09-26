// Generates obstacles for ObstaclePrefetch off the main thread.
import { createObstacle } from './sim/generator.js';

self.onmessage = ({ data: { seed, gap } }) => {
  const obstacle = createObstacle(seed, gap);
  self.postMessage({ seed, gap, obstacle: obstacle && obstacle.toData() });
};
