import { describe, it, expect } from 'vitest';
import { RecordingGraphics } from '../src/art/recorder.js';
import { ROCK_VARIANTS, drawRockBody, rockVariant } from '../src/views/obstacles.js';

describe('rock outlines', () => {
  it('picks one of the variants per gap, all of them over a run of gaps, not in a cycle', () => {
    const picks = Array.from({ length: 2000 }, (_, gap) => rockVariant(gap));
    expect(picks.every((v) => Number.isInteger(v) && v >= 0 && v < ROCK_VARIANTS)).toBe(true);
    expect(new Set(picks).size).toBe(ROCK_VARIANTS);
    expect(picks.slice(0, ROCK_VARIANTS)).not.toEqual(picks.slice(ROCK_VARIANTS, 2 * ROCK_VARIANTS));
  });

  it('draws the same outline for the same variant, and different ones for different variants', () => {
    const outline = (variant) => drawRockBody(new RecordingGraphics(), variant).instructions[0].path[0].points;
    expect(outline(3)).toEqual(outline(3));
    expect(outline(3)).not.toEqual(outline(4));
  });
});
