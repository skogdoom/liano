import { describe, expect, it } from 'vitest';
import { registerLimb, registerTriangle } from '../src/art/registration.js';

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

  it('rejects unusable artist landmarks instead of exporting detached parts', () => {
    expect(() => registerLimb([1, 2], [1, 2], 21)).toThrow(/Invalid/);
    expect(() => registerTriangle([[0, 0], [1, 1], [2, 2]], [[0, 0], [1, 0], [0, 1]])).toThrow(/Degenerate/);
  });
});
