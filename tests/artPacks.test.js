import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validatePack } from '../src/art/packs.js';
import { Resvg } from '@resvg/resvg-js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const classic = read('../art/manifest.json');
const cartoon = read('../art/packs/cartoon/manifest.json');

describe('complete cartoon pack contracts', () => {
  it('raises only the cartoon ghost monkey opacity and still rejects arbitrary alpha changes', () => {
    const ghosts = cartoon.pieces.filter((p) => p.key.startsWith('monkey.shadow.'));
    expect(ghosts).toHaveLength(6);
    expect(ghosts.every((p) => p.alpha === 0.56)).toBe(true);
    expect(classic.pieces.filter((p) => p.key.startsWith('monkey.shadow.')).every((p) => p.alpha === 0.36)).toBe(true);
    expect(cartoon.pieces.find((p) => p.key === 'liana.shadow.rope').alpha).toBe(0.36);
    const broken = structuredClone(cartoon);
    broken.pieces.find((p) => p.key === 'monkey.shadow.torso').alpha = 0.8;
    broken.pieces.find((p) => p.key === 'liana.shadow.rope').alpha = 0.56;
    const errors = validatePack(classic, broken, 'cartoon').join('\n');
    expect(errors).toMatch(/monkey.shadow.torso: incompatible alpha/);
    expect(errors).toMatch(/liana.shadow.rope: incompatible alpha/);
  });

  it('keeps the area outside the snake silhouettes transparent', () => {
    for (const key of ['snake.coil', 'snake.head']) {
      const image = new Resvg(readFileSync(new URL(`../art/packs/cartoon/generated/${key}.svg`, import.meta.url))).render();
      const corners = [[3, 3], [image.width - 4, 3], [3, image.height - 4], [image.width - 4, image.height - 4]];
      for (const [x, y] of corners) expect(image.pixels[(y * image.width + x) * 4 + 3]).toBeLessThanOrEqual(1);
    }
  });

  it('covers every required frame plus the explicitly allowed title artwork', () => {
    expect(validatePack(classic, cartoon, 'cartoon')).toEqual([]);
    expect(cartoon.pieces).toHaveLength(176);
    expect(cartoon.pieces.reduce((sum, p) => sum + p.frames.length, 0)).toBe(595);
    const reordered = structuredClone(cartoon);
    const piece = reordered.pieces[0];
    piece.box = Object.fromEntries(Object.entries(piece.box).reverse());
    expect(validatePack(classic, reordered, 'cartoon')).toEqual([]);
  });

  it('rejects missing or duplicate pieces, incompatible joints and incomplete flipbooks', () => {
    const broken = structuredClone(cartoon);
    broken.pieces.pop(); broken.pieces.shift();
    broken.pieces.push(broken.pieces[0]);
    broken.pieces.find((p) => p.key === 'monkey.p1.torso').attach.armFront = [999, 999];
    broken.pieces.find((p) => p.key === 'bird.red.wing').frames.pop();
    const errors = validatePack(classic, broken, 'cartoon').join('\n');
    expect(errors).toMatch(/Missing piece: backdrop.sky/);
    expect(errors).toMatch(/Duplicate piece/);
    expect(errors).toMatch(/incompatible attach/);
    expect(errors).toMatch(/wrong frame count/);
    expect(validatePack(classic, cartoon, 'cartoon', { 'monkey.p1.arm': { pivot: [2, 0] } }).join('\n')).toMatch(/incompatible pivot/);
  });

  it('rejects repeated or unsafe source references instead of using classic art', () => {
    const broken = structuredClone(cartoon);
    const wings = broken.pieces.find((p) => p.key === 'bird.red.wing');
    wings.frames[1] = wings.frames[0]; wings.frames[2] = '../classic/frame.svg';
    expect(validatePack(classic, broken, 'cartoon').join('\n')).toMatch(/duplicate source/);
    expect(validatePack(classic, broken, 'cartoon').join('\n')).toMatch(/invalid source/);
    [wings.frames[3], wings.frames[4]] = [wings.frames[4], wings.frames[3]];
    expect(validatePack(classic, broken, 'cartoon').join('\n')).toMatch(/wrong frame source order/);
  });
});
