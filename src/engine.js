// During the move to Phaser (see PHASER_PLAN.md) the game comes in two versions: the
// Pixi one (today's game, the default) and the Phaser one. `?engine=phaser` picks the
// Phaser version and `?engine=pixi` the Pixi one; anything else gets the default.
export const ENGINES = ['pixi', 'phaser'];
export const DEFAULT_ENGINE = 'pixi';

export function engineFrom(search) {
  const value = new URLSearchParams(search).get('engine');
  return ENGINES.includes(value) ? value : DEFAULT_ENGINE;
}
