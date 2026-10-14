import { describe, expect, it } from 'vitest';
import { resolutionChoice, resolutionLimit, RESOLUTION_STORAGE_KEY } from '../src/phaser/resolution.js';
import { pixelRatio } from '../src/screen.js';

const safari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.5.2 Safari/605.1.15';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

describe('Phaser resolution choices', () => {
  it('uses the tested Safari balance without upscaling low-density screens', () => {
    for (const userAgent of [safari, iphone]) {
      const cap = resolutionLimit('', { userAgent });
      expect(cap).toBe(1.5);
      for (const [density, expected] of [[1, 1], [1.25, 1.25], [2, 1.5], [3, 1.5]]) {
        expect(pixelRatio({ devicePixelRatio: density }, cap)).toBe(expected);
      }
      expect(resolutionLimit('?resolution=2', { userAgent })).toBe(2);
      expect(resolutionLimit('?resolution=1', { userAgent })).toBe(1);
    }
  });

  it('retains the ordinary cap for other browser families and unknown browsers', () => {
    for (const userAgent of ['', 'Firefox/130.0',
      'AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
      `${iphone} CriOS/130.0`, `${iphone} FxiOS/130.0`, `${safari} Edg/130.0`]) {
      expect(resolutionLimit('', { userAgent })).toBe(2);
    }
  });

  it('lets explicit test URLs override saved choices without writing storage', () => {
    const writes = [];
    const win = { localStorage: {
      getItem(key) { expect(key).toBe(RESOLUTION_STORAGE_KEY); return '2'; },
      setItem(...args) { writes.push(args); },
    } };
    expect(resolutionChoice('', win)).toBe('2');
    expect(resolutionChoice('?resolution=1', win)).toBe('1');
    expect(resolutionChoice('?resolution=auto', win)).toBe('auto');
    expect(resolutionLimit('', { userAgent: safari, preference: resolutionChoice('', win) })).toBe(2);
    expect(writes).toEqual([]);
  });

  it('keeps Auto available when storage is blocked or contains an invalid value', () => {
    const blocked = { get localStorage() { throw new Error('Storage blocked'); } };
    expect(resolutionChoice('', blocked)).toBe('auto');
    expect(resolutionChoice('?resolution=1.5', blocked)).toBe('1.5');
    for (const value of [null, '', '0', '4', 'NaN', 'Infinity', 'garbage']) {
      expect(resolutionChoice('', { localStorage: { getItem: () => value } })).toBe('auto');
    }
    expect(resolutionLimit('?resolution=0', { userAgent: safari })).toBe(1.5);
  });
});
