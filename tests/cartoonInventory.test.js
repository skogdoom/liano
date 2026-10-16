import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cartoonInventory, inventorySummary } from '../src/art/cartoonInventory.js';

const manifest = JSON.parse(readFileSync(new URL('../art/manifest.json', import.meta.url), 'utf8'));

describe('cartoon authoring inventory', () => {
  it('covers every stable frame and preserves the rendering contracts', () => {
    const inventory = cartoonInventory(manifest);
    expect(inventory.pieceCount).toBe(180);
    expect(inventory.frameCount).toBe(583);
    expect(new Set(inventory.pieces.flatMap((p) => p.frames.map((f) => f.key))).size).toBe(583);
    const original = manifest.pieces.find((p) => p.key === 'monkey.p1.torso');
    const torso = inventory.pieces.find((p) => p.key === original.key);
    expect(torso).toMatchObject({ box: original.box, attach: original.attach, pivot: [0, 0] });
    expect(inventory.pieces.find((p) => p.key === 'liana.green.rope').length).toBe(420);
    expect(inventory.pieces.find((p) => p.key === 'monkey.shadow.torso').alpha).toBe(0.56);
    expect(inventorySummary(inventory).totals).toEqual({ pending: 583, painted: 0, reviewed: 0 });
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

  it('retires only the explicitly removed rock variants and retains progress on the six kept frames', () => {
    const previous = cartoonInventory(manifest);
    const rock = previous.pieces.find(p => p.key === 'rock.body');
    rock.frames[0].status = 'reviewed';
    for (let i = 6; i < 24; i++) rock.frames.push({ key: `rock.body.${i}`, status: 'painted' });
    const refreshed = cartoonInventory(manifest, previous).pieces.find(p => p.key === 'rock.body');
    expect(refreshed.frames).toHaveLength(6);
    expect(refreshed.frames[0].status).toBe('reviewed');
    rock.frames.push({ key: 'rock.body.24', status: 'painted' });
    expect(() => cartoonInventory(manifest, previous)).toThrow(/no longer/);
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
