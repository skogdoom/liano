import { mixSeed, mulberry32 } from '../../sim/rng.js';
import { BRANCH_TRUNK_X, trunkBottom } from '../../views/obstacles.js';
import { quadraticPoints } from './build.js';

// Small, static details built from the painted pack's existing pieces. Their
// own seed keeps bark, animals and gameplay generation independent of them.
export function branchPoleDetails(b, o) {
  const behind = [], front = [];
  const top = 28, bottom = trunkBottom(o) - 28;
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
      wood.setCrop(0, 0, 34 * at.zoom, at.size[1]).setX(49);
      const size = .42 + rand() * .16;
      detail.setScale(side * size, size).setRotation(side * (.1 + rand() * .35));
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
      detail.add(b.curve('support.vine', quadraticPoints([[side * 6, -4], [-side * 9, length * .5], [side * 10, length]])));
      for (const [x, dy, angle] of [[1, length * .45, -side * 1.1], [side * 10, length, side * 2.2]]) {
        const leaf = b.image('temple.leaf', Math.floor(rand() * 8));
        leaf.setPosition(x, dy).setRotation(angle).setScale(b.art.unit('temple.leaf') * .1);
        detail.add(leaf);
      }
      front.push(detail);
    }
  }
  return { behind, front };
}
