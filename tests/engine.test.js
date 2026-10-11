import { describe, it, expect } from 'vitest';
import { DEFAULT_ENGINE, ENGINES, engineFrom } from '../src/engine.js';

describe('choosing the version of the game', () => {
  it('runs the Pixi version unless the URL asks for Phaser', () => {
    expect(DEFAULT_ENGINE).toBe('pixi');
    expect(ENGINES).toEqual(['pixi', 'phaser']);
    expect(engineFrom('')).toBe('pixi');
    expect(engineFrom('?engine=phaser')).toBe('phaser');
    expect(engineFrom('?engine=pixi')).toBe('pixi');
    expect(engineFrom('?debug=1&engine=phaser')).toBe('phaser');
  });

  it('ignores a version it does not know, and the old parameter name', () => {
    expect(engineFrom('?engine=canvas')).toBe('pixi');
    expect(engineFrom('?engine=')).toBe('pixi');
    expect(engineFrom('?engine=Phaser')).toBe('pixi');
    expect(engineFrom('?renderer=phaser')).toBe('pixi');
  });
});
