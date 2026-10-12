import { describe, it, expect } from 'vitest';
import { pack } from '../src/art/pack.js';

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('packing atlas pages', () => {
  it('places every cell once, apart and inside its page', () => {
    const cells = Array.from({ length: 60 }, (_, i) => ({ name: `c${i}`, w: 10 + ((i * 37) % 90), h: 8 + ((i * 53) % 70) }));
    const pages = pack(cells, { width: 256, maxHeight: 256, padding: 2 });
    const placed = pages.flatMap((p) => p.cells);
    expect(placed.map((c) => c.name).sort()).toEqual(cells.map((c) => c.name).sort());
    for (const page of pages) {
      expect(page.height % 4).toBe(0);
      for (const [i, a] of page.cells.entries()) {
        expect(a.x).toBeGreaterThanOrEqual(2);
        expect(a.y).toBeGreaterThanOrEqual(2);
        expect(a.x + a.w).toBeLessThanOrEqual(page.width - 2);
        expect(a.y + a.h).toBeLessThanOrEqual(page.height);
        for (const b of page.cells.slice(i + 1)) expect(overlap({ ...a, w: a.w + 2, h: a.h + 2 }, b)).toBe(false);
      }
    }
    expect(pages.length).toBeGreaterThan(1);
  });

  it('refuses a cell bigger than a page', () => {
    expect(() => pack([{ name: 'huge', w: 300, h: 10 }], { width: 256, maxHeight: 256 })).toThrow(/huge/);
  });
});
