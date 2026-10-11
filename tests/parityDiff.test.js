import { describe, it, expect } from 'vitest';
import { PARITY, compareImages, passes } from '../src/parity/diff.js';

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
    expect(passes({ share: PARITY.share - 1e-9 })).toBe(true);
    expect(passes({ share: PARITY.share })).toBe(false);
  });

  it('refuses images of different sizes', () => {
    expect(() => compareImages(image(2, [0, 0, 0, 0]), image(3, [0, 0, 0, 0]))).toThrow(/size/);
  });
});
