import { describe, expect, it } from 'vitest';
import { applyArtChoice, artChoice, ART_STORAGE_KEY, rememberArtChoice } from '../src/platform/artStyle.js';
import { applyResolutionChoice } from '../src/platform/resolution.js';

function windowFor(href = 'https://example.test/liano/?frames=1&resolution=1.5#game') {
  const values = new Map(), assigned = [];
  return { values, assigned, location: { href, assign: (url) => assigned.push(url) },
    localStorage: { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) } };
}

describe('art pack preferences and navigation', () => {
  it('defaults to classic and gives explicit URLs precedence without saving them', () => {
    const win = windowFor();
    expect(artChoice('', win)).toBe('classic');
    win.values.set(ART_STORAGE_KEY, 'cartoon');
    expect(artChoice('', win)).toBe('cartoon');
    expect(artChoice('?art=classic', win)).toBe('classic');
    expect(artChoice('?art=typo', win)).toBe('classic');
    expect(artChoice('?art=', win)).toBe('classic');
    expect(win.values.get(ART_STORAGE_KEY)).toBe('cartoon');
    win.values.set(ART_STORAGE_KEY, 'typo');
    expect(artChoice('', win)).toBe('classic');
  });

  it('survives unavailable storage while the explicit URL still selects the pack', () => {
    const win = windowFor();
    win.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(artChoice('', win)).toBe('classic');
    expect(artChoice('?art=cartoon', win)).toBe('cartoon');
    rememberArtChoice('cartoon', win);
    applyArtChoice('cartoon', win);
    expect(new URL(win.assigned[0]).searchParams.get('art')).toBe('cartoon');
  });

  it('preserves quality, diagnostics, hash and current title settings across an art reload', () => {
    const win = windowFor();
    applyArtChoice('cartoon', win, { mode: 'split', muted: true, settings: { lives: true, slip: true, shadow: false } });
    const next = new URL(win.assigned[0]);
    expect(Object.fromEntries(next.searchParams)).toEqual({ frames: '1', resolution: '1.5', mode: 'split', lives: 'on', slip: 'on', shadow: 'off', mute: 'on', art: 'cartoon' });
    expect(next.hash).toBe('#game');
    expect(win.values.get(ART_STORAGE_KEY)).toBe('cartoon');
    win.location.href = next.href;
    applyResolutionChoice('1', win, { mode: 'solo', muted: false, settings: { lives: false, slip: false, shadow: true } });
    expect(Object.fromEntries(new URL(win.assigned[1]).searchParams)).toEqual({ frames: '1', resolution: '1', art: 'cartoon' });
  });

  it('ignores invalid choices rather than navigating or saving them', () => {
    const win = windowFor();
    applyArtChoice('broken', win);
    rememberArtChoice('broken', win);
    expect(win.assigned).toEqual([]);
    expect(win.values.size).toBe(0);
  });
});
