// During the move to Phaser (see PHASER_PLAN.md) the game comes in two versions: the
// Pixi one (today's game, the default) and the Phaser one. `?renderer=phaser` picks
// the Phaser version and `?renderer=pixi` the Pixi one; anything else gets the default.
export const RENDERERS = ['pixi', 'phaser'];
export const DEFAULT_RENDERER = 'pixi';

export function rendererFrom(search) {
  const value = new URLSearchParams(search).get('renderer');
  return RENDERERS.includes(value) ? value : DEFAULT_RENDERER;
}
