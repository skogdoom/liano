import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cartoonInventory, inventorySummary } from '../src/art/cartoonInventory.js';

const manifest = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

describe('cartoon authoring inventory', () => {
  it('covers every stable frame and preserves the rendering contracts', () => {
    const inventory = cartoonInventory(manifest);
    expect(inventory.pieceCount).toBe(175);
    expect(inventory.frameCount).toBe(594);
    expect(new Set(inventory.pieces.flatMap((p) => p.frames.map((f) => f.key))).size).toBe(594);
    const original = manifest.pieces.find((p) => p.key === 'monkey.p1.torso');
    const torso = inventory.pieces.find((p) => p.key === original.key);
    expect(torso).toMatchObject({ box: original.box, attach: original.attach, pivot: [0, 0] });
    expect(inventory.pieces.find((p) => p.key === 'liana.green.rope').length).toBe(420);
    expect(inventorySummary(inventory).totals).toEqual({ pending: 594, painted: 0, reviewed: 0 });
  });

  it('preserves artist progress while refreshing authoritative contract data', () => {
    const previous = cartoonInventory(manifest);
    const frame = previous.pieces[0].frames[0];
    Object.assign(frame, { status: 'painted', source: 'source/sky.png', sheet: 'scenery',
      sourceCell: { x: 0, y: 0, w: 32, h: 256 }, cell: { x: 2, y: 2, w: 32, h: 256 }, notes: 'Needs night review' });
    previous.pieces[0].box.w = 999;
    const refreshed = cartoonInventory(manifest, previous);
    expect(refreshed.pieces[0].frames[0]).toEqual(frame);
    expect(refreshed.pieces[0].box).toEqual(manifest.pieces[0].box);
    expect(inventorySummary(refreshed).totals.painted).toBe(1);
  });

  it('refuses duplicate, stale and invalid progress rather than losing it', () => {
    const previous = cartoonInventory(manifest);
    previous.pieces[0].frames.push({ ...previous.pieces[0].frames[0] });
    expect(() => cartoonInventory(manifest, previous)).toThrow(/Duplicate/);
    previous.pieces[0].frames.pop();
    previous.pieces[0].frames[0].key = 'unknown.frame';
    expect(() => cartoonInventory(manifest, previous)).toThrow(/no longer/);
    previous.pieces[0].frames[0].status = 'ready-ish';
    expect(() => cartoonInventory(manifest, previous)).toThrow(/Invalid/);
  });

  it('keeps the committed inventory synchronized with the manifest', () => {
    const saved = JSON.parse(readFileSync(new URL('../art/packs/cartoon/inventory.json', import.meta.url), 'utf8'));
    expect(cartoonInventory(manifest, saved)).toEqual(saved);
  });
});
