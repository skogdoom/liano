import { describe, it, expect } from 'vitest';
import { PARITY, compareImages, passes, solidPixels } from '../src/visualDiff.js';

// An image of `n` pixels, all of one RGBA colour.
const image = (n, rgba) => Uint8ClampedArray.from({ length: n * 4 }, (_, i) => rgba[i % 4]);

describe('the parity diff', () => {
  it('counts identical images as identical', () => {
    const a = image(100, [10, 20, 30, 255]);
    const result = compareImages(a, a.slice());
    expect(result).toMatchObject({ pixels: 100, differing: 0, share: 0, maxDelta: 0 });
    expect(passes(result)).toBe(true);
  });

  it(`counts a pixel as different only past ${PARITY.channel}/255 in some channel`, () => {
    const a = image(4, [100, 100, 100, 255]);
    const b = a.slice();
    b[0] = 100 + PARITY.channel; // pixel 0: at the limit, still the same
    b[4 + 1] = 100 - PARITY.channel - 1; // pixel 1: past it in green
    b[8 + 3] = 255 - PARITY.channel - 1; // pixel 2: past it in alpha
    const result = compareImages(a, b);
    expect(result.differing).toBe(2);
    expect(result.share).toBe(0.5);
    expect(result.maxDelta).toBe(PARITY.channel + 1);
    // The picture of the differences: red where over the limit, grey below it.
    expect([...result.diff.slice(4, 8)]).toEqual([255, 0, 0, 255]);
    expect([...result.diff.slice(0, 4)]).toEqual([128, 128, 128, 255]);
  });

  it(`passes under ${PARITY.share * 100} % of the pixels differing`, () => {
    expect(passes({ share: PARITY.share - 1e-9, pixels: 1e6 })).toBe(true);
    expect(passes({ share: PARITY.share, pixels: 1e6 })).toBe(false);
  });

  it(`passes with up to ${PARITY.solidPerMillion} pixels per million in solid patches`, () => {
    expect(passes({ share: 0, pixels: 2e6, solid: 2 * PARITY.solidPerMillion })).toBe(true);
    expect(passes({ share: 0, pixels: 2e6, solid: 2 * PARITY.solidPerMillion + 1 })).toBe(false);
  });

  it('refuses images of different sizes', () => {
    expect(() => compareImages(image(2, [0, 0, 0, 0]), image(3, [0, 0, 0, 0]))).toThrow(/size/);
  });

  it('counts the differing pixels in solid patches, not on thin rims', () => {
    // 10 × 10: a 1-pixel line across row 2 and a 4 × 4 block at (5, 5).
    const width = 10;
    const a = image(100, [0, 0, 0, 255]);
    const b = a.slice();
    const mark = (x, y) => (b[(y * width + x) * 4] = 255);
    for (let x = 0; x < width; x++) mark(x, 2);
    for (let y = 5; y < 9; y++) for (let x = 5; x < 9; x++) mark(x, y);
    const result = compareImages(a, b);
    expect(result.differing).toBe(26);
    // Only the block's inner 2 × 2 has all eight neighbours over the limit.
    expect(solidPixels(result, width)).toBe(4);
  });
});
