import { describe, expect, it } from 'vitest';
import { registerLimb, registerTriangle } from '../src/art/registration.js';
import { readFileSync } from 'node:fs';
import { imageSize } from '../src/art/custom.js';
import { Resvg } from '@resvg/resvg-js';

const apply = ([a, b, c, d, e, f], [x, y]) => [a * x + c * y + e, b * x + d * y + f];
const near = (actual, expected) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 10));

describe('painted joint registration', () => {
  it('pins a slanted painted shoulder and palm to the rig pivot and grip distance', () => {
    const shoulder = [64, 57], palm = [108, 382], matrix = registerLimb(shoulder, palm, 21);
    near(apply(matrix, shoulder), [0, 0]);
    near(apply(matrix, palm), [0, 21]);
    // Turning an arm cannot move its shoulder away from the body's attachment.
    for (const angle of [-2.1, -.4, .8, 2.1]) {
      const [x, y] = apply(matrix, shoulder);
      near([x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)], [0, 0]);
    }
  });

  it('registers both painted torso shoulders and the hip midpoint together', () => {
    const source = [[58, 61], [279, 65], [144, 365]], target = [[-7, -1], [7, -1], [0, 15]];
    const matrix = registerTriangle(source, target);
    source.forEach((point, i) => near(apply(matrix, point), target[i]));
  });

  it('places the hanging legs at the hip sockets actually exported in the torso', () => {
    const root = new URL('../art/packs/cartoon/', import.meta.url);
    const layout = JSON.parse(readFileSync(new URL('source-layout.json', root)));
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
    const svg = readFileSync(new URL('generated/hangingMonkey.body.svg', root), 'utf8');
    const matrix = svg.match(/href="#[^"]*picture-monkey-torso" transform="matrix\(([^)]+)\)"/)[1].split(' ').map(Number);
    const { width, height } = imageSize('monkey-torso.png', readFileSync(new URL('components/monkey-torso.png', root)));
    const marks = layout.components['monkey-torso'].landmarks;
    for (const [i, name] of ['hipBack', 'hipFront'].entries()) {
      near(manifest.presentation.hangingMonkeyHips[i], apply(matrix, [marks[name][0] * width, marks[name][1] * height]));
      expect(manifest.presentation.hangingMonkeyHips[i][1]).toBeLessThan(42);
    }
  });

  it('buries each player and ghost tail socket inside the painted rear hip', () => {
    const root = new URL('../art/packs/cartoon/', import.meta.url);
    const layout = JSON.parse(readFileSync(new URL('source-layout.json', root)));
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
    const size = name => imageSize(`${name}.png`, readFileSync(new URL(`components/${name}.png`, root)));
    const tailSize = size('monkey-tail'), torsoSize = size('monkey-torso');
    const point = (name, mark, dimensions) => layout.components[name].landmarks[mark].map((v, i) => v * [dimensions.width, dimensions.height][i]);
    const matrix = (svg, name) => svg.match(new RegExp(`href="#[^"]*picture-${name}" transform="matrix\\(([^)]+)\\)"`))[1].split(' ').map(Number);
    for (const fur of ['p1', 'p2', 'shadow']) {
      const source = part => readFileSync(new URL(`generated/monkey.${fur}.${part}.svg`, root), 'utf8');
      const tailRoot = apply(matrix(source('tail'), 'monkey-tail'), point('monkey-tail', 'root', tailSize));
      near(tailRoot, apply(matrix(source('torso'), 'monkey-torso'), point('monkey-torso', 'tailRoot', torsoSize)));
      // The root must be covered by actual fur, not just lie inside its box.
      const piece = manifest.pieces.find(p => p.key === `monkey.${fur}.torso`);
      const image = new Resvg(source('torso'), { fitTo: { mode: 'zoom', value: 4 } }).render();
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        const x = Math.round((tailRoot[0] + dx - piece.box.x) * 4);
        const y = Math.round((tailRoot[1] + dy - piece.box.y) * 4);
        expect(image.pixels[(y * image.width + x) * 4 + 3]).toBeGreaterThan(255 * (piece.alpha ?? 1) * .95);
      }
    }
  });

  it('rejects unusable artist landmarks instead of exporting detached parts', () => {
    expect(() => registerLimb([1, 2], [1, 2], 21)).toThrow(/Invalid/);
    expect(() => registerTriangle([[0, 0], [1, 1], [2, 2]], [[0, 0], [1, 0], [0, 1]])).toThrow(/Degenerate/);
  });
});
