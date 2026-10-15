import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validatePack } from '../src/art/packs.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const classic = read('../art/manifest.json');
const cartoon = read('../art/packs/cartoon/manifest.json');

describe('complete cartoon pack contracts', () => {
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
