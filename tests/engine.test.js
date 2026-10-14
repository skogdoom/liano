import { describe, it, expect } from 'vitest';
import { DEFAULT_ENGINE, ENGINES, engineFrom } from '../src/engine.js';

describe('choosing the version of the game', () => {
  it('runs the Phaser version unless the URL asks for Pixi', () => {
    expect(DEFAULT_ENGINE).toBe('phaser');
    expect(ENGINES).toEqual(['pixi', 'phaser']);
    expect(engineFrom('')).toBe('phaser');
    expect(engineFrom('?engine=phaser')).toBe('phaser');
    expect(engineFrom('?engine=pixi')).toBe('pixi');
    expect(engineFrom('?debug=1&engine=pixi')).toBe('pixi');
  });

  it('ignores a version it does not know, and the old parameter name', () => {
    expect(engineFrom('?engine=canvas')).toBe('phaser');
    expect(engineFrom('?engine=')).toBe('phaser');
    expect(engineFrom('?engine=Pixi')).toBe('phaser');
    expect(engineFrom('?renderer=pixi')).toBe('phaser');
  });
});
