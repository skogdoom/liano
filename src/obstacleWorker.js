// Generates obstacles and bananas for ObstaclePrefetch off the main thread.
import { createBanana, createObstacle } from './sim/generator.js';

self.onmessage = ({ data: { seed, gap } }) => {
  const obstacle = createObstacle(seed, gap);
  const banana = createBanana(seed, gap, obstacle);
  self.postMessage({ seed, gap, obstacle: obstacle && obstacle.toData(), banana: banana && banana.toData() });
};
