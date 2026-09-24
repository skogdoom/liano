import { describe, it, expect } from 'vitest';
import { isOwnError } from '../src/fatal.js';

describe('which errors show the reload message', () => {
  const origin = 'https://skogdoom.github.io';

  it('counts errors from our own scripts', () => {
    expect(isOwnError({ filename: `${origin}/liano/assets/index-abc.js` }, origin)).toBe(true);
  });

  it('ignores extensions, other origins and anonymous cross-origin errors', () => {
    expect(isOwnError({ filename: 'chrome-extension://abc/content.js' }, origin)).toBe(false);
    expect(isOwnError({ filename: 'https://ads.example.com/x.js' }, origin)).toBe(false);
    expect(isOwnError({ filename: '', message: 'Script error.' }, origin)).toBe(false);
    expect(isOwnError({}, origin)).toBe(false);
  });
});
