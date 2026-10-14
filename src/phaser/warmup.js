import { BRANCH_DECORATIONS, MOVING_TYPES, Obstacle, STATIC_TYPES } from '../sim/obstacle.js';
import { ObstacleLayer } from './world/obstacleLayer.js';

// Exercise each finite builder path before accepting gameplay input. The atlas
// textures are already resident; these temporary rigs warm construction/posing code
// without retaining duplicate graphics or an unbounded pool of generated temples.
export function warmObstacleRigs(scene, art) {
  const layer = new ObstacleLayer(scene, art);
  const samples = STATIC_TYPES.filter((type) => type !== 'temple').flatMap((type) => [100, 350].map((y) => new Obstacle(1, type, 0, y)));
  samples.push(...[0, 1, 2, 3].map((variant) => new Obstacle(1, 'temple', 0, 100, null, 1, null, variant)));
  samples.push(...BRANCH_DECORATIONS.flatMap((decoration) => [100, 350].map((y) => new Obstacle(1, 'branch', 0, y, null, 1, decoration))));
  samples.push(...MOVING_TYPES.map((type) => new Obstacle(1, type, 0, 200, { period: 3, phase: 0, ax: 40, ay: 40, bob: 4 })));
  for (const obstacle of samples) {
    const rig = layer.build(obstacle);
    rig?.update?.(0.1, 0x4e6048);
    rig?.view.destroy();
  }
  layer.view.destroy();
  return samples.length;
}
