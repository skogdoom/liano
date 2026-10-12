import { describe, it, expect } from 'vitest';
import { checkPicture, checkSidecar, hitboxStray, imageSize, readCustom } from '../src/art/custom.js';

// A PNG header (enough for its size) and a small SVG.
function png(width, height) {
  const data = Buffer.alloc(33);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(data, 0);
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}
const svg = (viewBox) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><rect/></svg>`);

const manifest = {
  pieces: [
    { key: 'rock.body', box: { x: -30, y: -30, w: 60, h: 60 }, frames: ['a'] },
    { key: 'bird.wing', box: { x: 0, y: -20, w: 40, h: 20 }, frames: ['a', 'b', 'c'], fps: 12 },
  ],
};

describe('custom art', () => {
  it('reads the size of a PNG and of an SVG', () => {
    expect(imageSize('a.png', png(120, 60))).toEqual({ width: 120, height: 60 });
    expect(imageSize('a.svg', svg('0 0 40 20'))).toEqual({ width: 40, height: 20 });
    expect(imageSize('a.svg', Buffer.from('<svg width="30" height="15"></svg>'))).toEqual({ width: 30, height: 15 });
    expect(imageSize('a.png', Buffer.from('nope'))).toBe(null);
  });

  it('replaces a piece, or a frame of a flipbook, by name', () => {
    const { replace, errors } = readCustom(manifest, { 'rock.body.png': png(120, 120), 'bird.wing.1.svg': svg('0 0 80 40') });
    expect(errors).toEqual([]);
    expect(replace).toEqual({ 'rock.body': 'rock.body.png', 'bird.wing.1': 'bird.wing.1.svg' });
  });

  it('names what is wrong: unknown names, frames without a number, two files for one, other types', () => {
    const { errors } = readCustom(manifest, {
      'rock.boulder.png': png(120, 120),
      'bird.wing.svg': svg('0 0 80 40'),
      'rock.body.png': png(120, 120),
      'rock.body.svg': svg('0 0 60 60'),
      'rock.body.gif': Buffer.from('x'),
      '.DS_Store': Buffer.from('x'),
    });
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toMatch(/rock.boulder/);
    expect(errors.join('\n')).toMatch(/3 frames/);
    expect(errors.join('\n')).toMatch(/replaced twice/);
    expect(errors.join('\n')).toMatch(/not an SVG or a PNG/);
  });

  it('wants the box’s aspect, and a PNG at least twice the logical size', () => {
    const rock = manifest.pieces[0];
    expect(checkPicture(rock, 'r.png', png(120, 120))).toEqual([]);
    expect(checkPicture(rock, 'r.png', png(100, 100))[0]).toMatch(/at least 120 × 120/);
    expect(checkPicture(rock, 'r.png', png(240, 120))[0]).toMatch(/aspect/);
    expect(checkPicture(rock, 'r.svg', svg('0 0 6 6'))).toEqual([]); // an SVG scales
  });

  it('lets a sidecar move the pivot within the box, and change a flipbook’s rate, nothing else', () => {
    const [rock, wing] = manifest.pieces;
    expect(checkSidecar(rock, { pivot: [0, 10] })).toEqual([]);
    expect(checkSidecar(rock, { pivot: [50, 0] })[0]).toMatch(/outside/);
    expect(checkSidecar(rock, { fps: 10 })[0]).toMatch(/flipbooks/);
    expect(checkSidecar(wing, { fps: 8 })).toEqual([]);
    expect(checkSidecar(wing, { frames: 4 })[0]).toMatch(/cannot be changed/);
    const { sidecars, errors } = readCustom(manifest, { 'bird.wing.json': Buffer.from('{"fps": 8}'), 'rock.body.json': Buffer.from('{') });
    expect(sidecars).toEqual({ 'bird.wing': { fps: 8 } });
    expect(errors[0]).toMatch(/not valid JSON/);
  });

  it('warns when the art strays far from the hitbox, or leaves much of it bare', () => {
    const hitbox = [{ dx: 0, dy: 0, r: 20 }];
    expect(hitboxStray({ x0: -22, x1: 22, y0: -21, y1: 20 }, hitbox)).toBe(null);
    expect(hitboxStray({ x0: -60, x1: 60, y0: -20, y1: 20 }, hitbox)).toMatch(/past the hitbox/);
    expect(hitboxStray({ x0: -5, x1: 5, y0: -5, y1: 5 }, hitbox)).toMatch(/covers only/);
  });
});
