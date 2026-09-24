import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));

// Width and height from a PNG's IHDR chunk.
function pngSize(buffer) {
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

describe('web app manifest', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));

  it('is a landscape full-screen app with relative URLs', () => {
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.start_url).toBe('./');
    for (const icon of manifest.icons) expect(icon.src.startsWith('/')).toBe(false);
  });

  it('points at icons that exist with the declared sizes', () => {
    for (const icon of manifest.icons) {
      const [w, h] = pngSize(read(`public/${icon.src}`));
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  it('is linked from index.html together with an apple-touch-icon', () => {
    const html = read('index.html').toString();
    const href = (rel) => html.match(new RegExp(`rel="${rel}" href="/([^"]+)"`))?.[1];
    expect(href('manifest')).toBe('manifest.webmanifest');
    const touchIcon = href('apple-touch-icon');
    expect(existsSync(new URL(`public/${touchIcon}`, root))).toBe(true);
    expect(pngSize(read(`public/${touchIcon}`))).toEqual([180, 180]);
  });
});
