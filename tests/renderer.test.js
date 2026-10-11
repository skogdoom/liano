import { describe, it, expect } from 'vitest';
import { DEFAULT_RENDERER, RENDERERS, rendererFrom } from '../src/renderer.js';

describe('choosing the version of the game', () => {
  it('runs the Pixi version unless the URL asks for Phaser', () => {
    expect(DEFAULT_RENDERER).toBe('pixi');
    expect(RENDERERS).toEqual(['pixi', 'phaser']);
    expect(rendererFrom('')).toBe('pixi');
    expect(rendererFrom('?renderer=phaser')).toBe('phaser');
    expect(rendererFrom('?renderer=pixi')).toBe('pixi');
    expect(rendererFrom('?debug=1&renderer=phaser')).toBe('phaser');
  });

  it('ignores a version it does not know', () => {
    expect(rendererFrom('?renderer=canvas')).toBe('pixi');
    expect(rendererFrom('?renderer=')).toBe('pixi');
    expect(rendererFrom('?renderer=Phaser')).toBe('pixi');
  });
});
