// During the move to Phaser (see PHASER_PLAN.md) the game comes in two versions: the
// Phaser one (the default since M7) and the Pixi one, until M8 removes it. `?engine=pixi`
// picks the Pixi version and `?engine=phaser` the Phaser one; anything else gets the default.
export const ENGINES = ['pixi', 'phaser'];
export const DEFAULT_ENGINE = 'phaser';

export function engineFrom(search) {
  const value = new URLSearchParams(search).get('engine');
  return ENGINES.includes(value) ? value : DEFAULT_ENGINE;
}
