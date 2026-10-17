import { describe, expect, it } from 'vitest';
import { STATIC_RIGS } from '../src/render/world/obstacles.js';
import { mulberry32 } from '../src/sim/rng.js';

function hive(gap, hangs) {
  const images = [];
  const image = (key) => {
    const sprite = { key, x: 0, y: 0, scaleY: 1,
      setPosition(x, y) { Object.assign(this, { x, y }); return this; } };
    images.push(sprite);
    return sprite;
  };
  const b = { image, art: { unit: () => 1 },
    stretched: image, curve: (key) => [image(key)] };
  const added = [];
  const update = STATIC_RIGS.beehive(b, { gap, y: hangs ? 190 : 340, scale: 1 }, mulberry32(42), hangs,
    { add: (parts) => added.push(...parts) });
  return { images, added, update };
}

describe('beehive activity', () => {
  for (const hangs of [true, false]) {
    it(`keeps the ${hangs ? 'hanging' : 'standing'} hive empty through night, including later cycles`, () => {
      for (const gap of [51, 70, 151, 170]) {
        const { images, added, update } = hive(gap, hangs);
        expect(update).toBeNull();
        expect(images.map((v) => v.key)).toContain('beehive.nest');
        expect(images.some((v) => v.key.startsWith('bee.'))).toBe(false);
        expect(added).toEqual(images);
      }
    });

    it(`animates the ${hangs ? 'hanging' : 'standing'} swarm outside night, including dusk and dawn`, () => {
      for (const gap of [3, 16, 50, 71, 91]) {
        const { images, added, update } = hive(gap, hangs);
        const bees = images.filter((v) => v.key === 'bee.body');
        expect(bees).toHaveLength(5);
        expect(images.filter((v) => v.key === 'bee.wing')).toHaveLength(10);
        expect(added).toEqual(images);
        update(0);
        const before = bees.map(({ x, y }) => [x, y]);
        update(1);
        expect(bees.map(({ x, y }) => [x, y])).not.toEqual(before);
      }
    });
  }
});
