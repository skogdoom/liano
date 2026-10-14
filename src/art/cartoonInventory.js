import { ATLAS_SCALES, cellOf } from './catalog.js';
import { frameName } from './piece.js';

export const FRAME_STATUSES = ['pending', 'painted', 'reviewed'];

// Authoring inventory, independent of the game loader. Progress survives regeneration;
// rendering contracts always come from the current classic manifest.
export function cartoonInventory(manifest, previous = null) {
  const progress = new Map();
  for (const piece of previous?.pieces ?? []) {
    for (const frame of piece.frames) {
      if (progress.has(frame.key)) throw new Error(`Duplicate inventory frame: ${frame.key}`);
      if (!FRAME_STATUSES.includes(frame.status)) throw new Error(`Invalid frame status: ${frame.key}`);
      progress.set(frame.key, frame);
    }
  }
  const names = new Set();
  const pieces = manifest.pieces.map((piece) => {
    const frames = piece.frames.map((_, i) => {
      const key = frameName(piece, i);
      if (names.has(key)) throw new Error(`Duplicate manifest frame: ${key}`);
      names.add(key);
      const old = progress.get(key);
      return {
        key,
        status: old?.status ?? 'pending',
        source: old?.source ?? null,
        sourceCell: old?.sourceCell ?? null,
        sheet: old?.sheet ?? piece.key.split('.')[0],
        cell: old?.cell ?? null,
        notes: old?.notes ?? '',
      };
    });
    const { key, purpose, kind, set, box, scale, tint, attach, slices, length, fps, alpha, density, soften } = piece;
    return {
      key, purpose, kind, set, box: { ...box }, scale, tint,
      pivot: [0, 0],
      ...(attach && { attach: structuredClone(attach) }),
      ...(slices && { slices: { ...slices } }),
      ...(length !== undefined && { length }),
      ...(fps !== undefined && { fps }),
      ...(alpha !== undefined && { alpha }),
      ...(density !== undefined && { density }),
      ...(soften !== undefined && { soften }),
      ...(piece.hitbox && { hitbox: structuredClone(piece.hitbox) }),
      exports: Object.fromEntries(ATLAS_SCALES.map((s) => [s, cellOf(piece, s)])),
      frames,
    };
  });
  for (const key of progress.keys()) {
    if (!names.has(key)) throw new Error(`Inventory frame no longer in the manifest: ${key}`);
  }
  return { schemaVersion: 1, pack: 'cartoon', pieceCount: pieces.length, frameCount: names.size, pieces };
}

export function inventorySummary(inventory) {
  const groups = new Map();
  const totals = Object.fromEntries(FRAME_STATUSES.map((status) => [status, 0]));
  for (const piece of inventory.pieces) {
    const family = piece.key.split('.')[0];
    if (!groups.has(family)) groups.set(family, { pieces: 0, ...Object.fromEntries(FRAME_STATUSES.map((s) => [s, 0])) });
    const group = groups.get(family);
    group.pieces++;
    for (const frame of piece.frames) {
      if (!FRAME_STATUSES.includes(frame.status)) throw new Error(`Invalid frame status: ${frame.key}`);
      totals[frame.status]++;
      group[frame.status]++;
    }
  }
  return { totals, families: [...groups].map(([family, counts]) => ({ family, ...counts })) };
}
