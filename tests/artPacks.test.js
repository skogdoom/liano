import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validatePack } from '../src/art/packs.js';
import { Resvg } from '@resvg/resvg-js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const classic = read('../art/manifest.json');
const cartoon = read('../art/packs/cartoon/manifest.json');

describe('complete cartoon pack contracts', () => {
  it('raises only the cartoon ghost monkey opacity and still rejects arbitrary alpha changes', () => {
    const ghosts = cartoon.pieces.filter((p) => p.key.startsWith('monkey.shadow.'));
    expect(ghosts).toHaveLength(6);
    expect(ghosts.every((p) => p.alpha === 0.56)).toBe(true);
    expect(classic.pieces.filter((p) => p.key.startsWith('monkey.shadow.')).every((p) => p.alpha === 0.36)).toBe(true);
    expect(cartoon.pieces.find((p) => p.key === 'liana.shadow.rope').alpha).toBe(0.36);
    const broken = structuredClone(cartoon);
    broken.pieces.find((p) => p.key === 'monkey.shadow.torso').alpha = 0.8;
    broken.pieces.find((p) => p.key === 'liana.shadow.rope').alpha = 0.56;
    const errors = validatePack(classic, broken, 'cartoon').join('\n');
    expect(errors).toMatch(/monkey.shadow.torso: incompatible alpha/);
    expect(errors).toMatch(/liana.shadow.rope: incompatible alpha/);
  });

  it('keeps the area outside the snake silhouettes transparent', () => {
    for (const key of ['snake.coil', 'snake.head']) {
      const image = new Resvg(readFileSync(new URL(`../art/packs/cartoon/generated/${key}.svg`, import.meta.url))).render();
      const corners = [[3, 3], [image.width - 4, 3], [3, image.height - 4], [image.width - 4, image.height - 4]];
      for (const [x, y] of corners) expect(image.pixels[(y * image.width + x) * 4 + 3]).toBeLessThanOrEqual(1);
    }
  });

  it('draws branch-snake bands as single strands between the rig attachments', () => {
    const piece = cartoon.pieces.find((p) => p.key === 'perchedSnake.band');
    for (const [frame, from, to, outside] of [[0, [-14, 0], [14, 6], [0, 24]], [1, [-4, 0], [4, 22], [-20, 5]]]) {
      const image = new Resvg(readFileSync(new URL(`../art/packs/cartoon/${piece.frames[frame]}`, import.meta.url))).render();
      const alphaAt = ([x, y]) => image.pixels[((y - piece.box.y) * image.width + x - piece.box.x) * 4 + 3];
      expect(alphaAt(from)).toBeGreaterThan(200);
      expect(alphaAt(to)).toBeGreaterThan(200);
      expect(alphaAt(outside)).toBe(0);
    }
  });

  it('keeps green snake silhouettes and pale details aligned with copper', () => {
    for (const green of cartoon.pieces.filter(p => p.key.startsWith('perchedSnake.green.'))) {
      const copper = cartoon.pieces.find(p => p.key === green.key.replace('.green.', '.'));
      expect(green.box).toEqual(copper.box);
      for (let frame = 0; frame < green.frames.length; frame++) {
        const render = p => new Resvg(readFileSync(new URL(`../art/packs/cartoon/${p.frames[frame]}`, import.meta.url)),
          { fitTo: { mode: 'width', value: p.box.w * 4 } }).render();
        const original = render(copper), variant = render(green);
        const a = original.pixels, b = variant.pixels;
        expect([variant.width, variant.height]).toEqual([original.width, original.height]);
        let greenPixels = 0, palePixels = 0;
        for (let i = 0; i < a.length; i += 4) {
          expect(Math.abs(a[i + 3] - b[i + 3]), green.frames[frame]).toBeLessThanOrEqual(1);
          if (b[i + 3] > 200 && b[i + 1] > b[i] * 1.2 && b[i + 1] > b[i + 2] * 1.2) greenPixels++;
          if (a[i + 3] > 250 && a[i] > 210 && a[i + 1] > a[i] * .85 && a[i + 2] > 100) {
            expect(Math.max(...[0, 1, 2].map(c => Math.abs(a[i + c] - b[i + c])))).toBeLessThanOrEqual(2);
            palePixels++;
          }
        }
        expect(greenPixels, green.frames[frame]).toBeGreaterThan(2);
        if (green.key.endsWith('.head')) expect(palePixels).toBeGreaterThan(10);
      }
    }
    const broken = structuredClone(cartoon);
    broken.pieces.find(p => p.key === 'perchedSnake.green.head').box.y++;
    expect(validatePack(classic, broken, 'cartoon')).toContain('perchedSnake.green.head: incompatible box');
    broken.pieces = broken.pieces.filter(p => p.key !== 'perchedSnake.green.tail');
    expect(validatePack(classic, broken, 'cartoon')).toContain('Missing piece: perchedSnake.green.tail');
  });

  it('retains full painted wings throughout the flap without clipping atlas edges', () => {
    for (const piece of cartoon.pieces.filter(p => /^(bird|bat)\.[^.]+\.wing$/.test(p.key))) {
      const areas = [];
      for (const frame of piece.frames) {
        const image = new Resvg(readFileSync(new URL(`../art/packs/cartoon/${frame}`, import.meta.url)),
          { fitTo: { mode: 'width', value: piece.box.w * 4 } }).render();
        const pixels = image.pixels;
        let area = 0, edge = 0;
        for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
          if (pixels[(y * image.width + x) * 4 + 3] < 32) continue;
          area++;
          if (x === 0 || x === image.width - 1 || y === 0 || y === image.height - 1) edge++;
        }
        expect(edge, `${frame}: clipped feather or membrane`).toBe(0);
        areas.push(area);
      }
      // The old bird triangle vanished at mid-stroke; the bat's shortening
      // membrane also lost much of its area. Check the actual painted pixels.
      expect(Math.min(...areas), piece.key).toBeGreaterThan(Math.max(...areas) * .85);
      expect(Math.min(...areas), piece.key).toBeGreaterThan(50);
    }
  });

  it('seats every painted stone on its ledge and attaches its hanging vine inside the silhouette', () => {
    const piece = cartoon.pieces.find(p => p.key === 'rock.body');
    const ledge = cartoon.pieces.find(p => p.key === 'rock.ledge');
    const platform = new Resvg(readFileSync(new URL(`../art/packs/cartoon/${ledge.frames[0]}`, import.meta.url)),
      { fitTo: { mode: 'width', value: ledge.box.w * 4 } }).render();
    const platformPixels = platform.pixels;
    const top = Array.from({ length: platform.width }, (_, x) => {
      let y = 0;
      while (y < platform.height && platformPixels[(y * platform.width + x) * 4 + 3] < 128) y++;
      return y < platform.height ? y / 4 + ledge.box.y : Infinity;
    });
    for (let frame = 0; frame < piece.frames.length; frame++) {
      const source = readFileSync(new URL(`../art/packs/cartoon/${piece.frames[frame]}`, import.meta.url));
      const image = new Resvg(source, { fitTo: { mode: 'width', value: piece.box.w * 4 } }).render();
      const pixels = image.pixels;
      const alpha = (x, y) => pixels[(Math.floor((y - piece.box.y) * 4) * image.width + Math.floor((x - piece.box.x) * 4)) * 4 + 3];
      expect(alpha(0, cartoon.presentation.hangingRockVineY[frame]), `variant ${frame}: floating vine`).toBeGreaterThan(180);
      let gap = Infinity;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        if (pixels[(y * image.width + x) * 4 + 3] < 128) continue;
        const wx = x / 4 + piece.box.x, wy = y / 4 + piece.box.y + cartoon.presentation.standingRockY[frame];
        const shelf = top[Math.floor((wx - ledge.box.x) * 4)] ?? Infinity;
        gap = Math.min(gap, shelf - wy);
      }
      expect(gap, `variant ${frame}: platform embed depth`).toBeGreaterThan(-3);
      expect(gap, `variant ${frame}: platform embed depth`).toBeLessThan(-1);
    }
  });

  it('covers every required frame plus the title and green snake palette', () => {
    expect(validatePack(classic, cartoon, 'cartoon')).toEqual([]);
    expect(cartoon.pieces).toHaveLength(181);
    expect(cartoon.pieces.reduce((sum, p) => sum + p.frames.length, 0)).toBe(584);
    const reordered = structuredClone(cartoon);
    const piece = reordered.pieces[0];
    piece.box = Object.fromEntries(Object.entries(piece.box).reverse());
    expect(validatePack(classic, reordered, 'cartoon')).toEqual([]);
  });

  it('allows six static cartoon stones while keeping classic variants and flipbooks complete', () => {
    expect(classic.pieces.find(p => p.key === 'rock.body').frames).toHaveLength(24);
    expect(cartoon.pieces.find(p => p.key === 'rock.body').frames).toHaveLength(6);
    const broken = structuredClone(cartoon);
    broken.pieces.find(p => p.key === 'rock.body').frames.pop();
    expect(validatePack(classic, broken, 'cartoon')).toContain('rock.body: wrong frame count');
    const unchanged = structuredClone(classic);
    unchanged.pieces.find(p => p.key === 'rock.body').frames.length = 6;
    // Use canonical source paths so this check isolates the static-variant policy.
    expect(validatePack(classic, unchanged, 'classic')).toContain('rock.body: wrong frame count');
  });

  it('rejects missing or duplicate pieces, incompatible joints and incomplete flipbooks', () => {
    const broken = structuredClone(cartoon);
    broken.pieces.pop(); broken.pieces.shift();
    broken.pieces.push(broken.pieces[0]);
    broken.pieces.find((p) => p.key === 'monkey.p1.torso').attach.armFront = [999, 999];
    broken.pieces.find((p) => p.key === 'bird.red.wing').frames.pop();
    const errors = validatePack(classic, broken, 'cartoon').join('\n');
    expect(errors).toMatch(/Missing piece: backdrop.sky/);
    expect(errors).toMatch(/Duplicate piece/);
    expect(errors).toMatch(/incompatible attach/);
    expect(errors).toMatch(/wrong frame count/);
    expect(validatePack(classic, cartoon, 'cartoon', { 'monkey.p1.arm': { pivot: [2, 0] } }).join('\n')).toMatch(/incompatible pivot/);
  });

  it('rejects repeated or unsafe source references instead of using classic art', () => {
    const broken = structuredClone(cartoon);
    const wings = broken.pieces.find((p) => p.key === 'bird.red.wing');
    wings.frames[1] = wings.frames[0]; wings.frames[2] = '../classic/frame.svg';
    expect(validatePack(classic, broken, 'cartoon').join('\n')).toMatch(/duplicate source/);
    expect(validatePack(classic, broken, 'cartoon').join('\n')).toMatch(/invalid source/);
    [wings.frames[3], wings.frames[4]] = [wings.frames[4], wings.frames[3]];
    expect(validatePack(classic, broken, 'cartoon').join('\n')).toMatch(/wrong frame source order/);
  });
});
