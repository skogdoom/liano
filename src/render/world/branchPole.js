import { mixSeed, mulberry32 } from '../../sim/rng.js';
import { BRANCH_TRUNK_X, trunkBottom } from '../../views/obstacles.js';
import { cubicPoints, quadraticPoints } from './build.js';

// Small, static details built from the painted pack's existing pieces. Their
// own seed keeps bark, animals and gameplay generation independent of them.
export function branchPoleDetails(b, o, occupiedBottom = 0) {
  const behind = [], front = [];
  // Include the details' upward reach, keeping the snake's entire envelope free.
  const top = Math.max(28, occupiedBottom + 28), bottom = trunkBottom(o) - 28;
  if (bottom - top < 45) return { behind, front };
  const rand = mulberry32(mixSeed(0x706f6c65, o.gap));
  const count = Math.min(2 + Math.floor(rand() * 2), Math.floor((bottom - top) / 40));
  for (let i = 0; i < count; i++) {
    const y = top + (i + .25 + rand() * .5) * (bottom - top) / count;
    const side = rand() < .5 ? -1 : 1;
    const kind = Math.floor(rand() * 3);
    const detail = b.container(BRANCH_TRUNK_X, y);
    if (kind === 0) {
      // Reuse only the sharp, sawn end. The pole covers the cropped root.
      const wood = b.image('branch.body'), at = b.art.at('branch.body');
      wood.setCrop(0, 0, 58 * at.zoom, at.size[1]).setX(25);
      const size = .42 + rand() * .16;
      const tilt = (rand() < .5 ? -1 : 1) * (Math.PI / 4 + (rand() - .5) * .16);
      detail.setScale(side * size, size).setRotation(tilt);
      detail.add(wood);
      behind.push(detail);
    } else if (kind === 1) {
      detail.add(b.curve('support.vine', quadraticPoints([[0, 1], [side * 8, -1], [side * 13, -7]])));
      for (const [x, dy, angle, size] of [[7, -2, 1.15, .17], [13, -7, .55, .14]]) {
        const leaf = b.image('temple.leaf', Math.floor(rand() * 8));
        leaf.setPosition(side * x, dy).setRotation(side * angle);
        leaf.setScale(b.art.unit('temple.leaf') * size);
        detail.add(leaf);
      }
      behind.push(detail);
    } else {
      const length = 26 + rand() * 18;
      // A fine creeper grows out from behind the pole and drops along its edge.
      // Leaves share points on the stem rather than floating beside a taut bow.
      const points = cubicPoints([[side * 5, -4], [side * 14, 0], [side * 17, length * .65], [side * 12, length]]);
      detail.add(b.curve('temple.vine', points, false));
      for (const [index, angle, size] of [[7, side * 1.9, .13], [14, -side * 2, .11], [21, side * 2.5, .085]]) {
        const { x, y } = points[index];
        const leaf = b.image('temple.leaf', Math.floor(rand() * 8));
        leaf.setPosition(x, y).setRotation(angle).setScale(b.art.unit('temple.leaf') * size);
        detail.add(leaf);
      }
      behind.push(detail);
    }
  }
  return { behind, front };
}
