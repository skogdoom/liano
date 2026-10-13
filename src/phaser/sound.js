import { SoundPlayer, whiteNoise } from '../audio/player.js';
import { SoundCache } from './soundCache.js';

// The sound player (audio/player.js) on Phaser's sound manager: the recipes play
// through Phaser's audio context and its master mute and volume nodes, mute is
// Phaser's, and Phaser unlocks the context at the first gesture. What the player adds:
//
// - Pause: Phaser resumes a suspended context every frame while the game has focus,
//   which would undo the game's own pause (P, a lost graphics context) and mute. The
//   player tells Phaser when the context is to stay suspended, through the flag Phaser
//   keeps for a lost focus, which it also sets itself on blur.
// - Recovery: a context that stays stuck is replaced, through Phaser's setAudioContext,
//   at the next gesture, as in the Pixi version.
// - Phaser starts and stops the context without handling a refusal, whose promise
//   would reach the error screen: refusals are ignored (the next frame tries again).
export function createPhaserSoundPlayer(manager, { createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(), now } = {}) {
  let first = true;
  let cache = null;
  const player = new SoundPlayer({
    now,
    noiseFor: (ctx) => cache?.noise ?? whiteNoise(ctx),
    bufferFor: (recipe) => cache?.get(recipe),
    createContext() {
      if (first) {
        if (!manager.context) return null;
        first = false;
        return ignoreRefusals(manager.context);
      }
      // Phaser closes the old one, and makes new mute and volume nodes.
      const ctx = ignoreRefusals(createContext());
      manager.setAudioContext(ctx);
      return ctx;
    },
    output: () => manager.destination,
    closeContext: () => {},
    applyMute: (muted) => manager.setMute(muted),
    onRun(run) {
      manager.gameLostFocus = !run;
    },
  });
  // Explicit preparation keeps the adapter usable with offline/fake contexts too.
  player.prepare = () => {
    if (!manager.context) return Promise.resolve(0);
    cache ??= new SoundCache(manager.context);
    player.cache = cache;
    return cache.prepare();
  };
  return player;
}

// Marks a refused resume() or suspend() as handled; callers still get the promise.
export function ignoreRefusals(ctx) {
  for (const name of ['resume', 'suspend']) {
    const original = ctx[name];
    if (typeof original !== 'function') continue;
    ctx[name] = function (...args) {
      const result = original.apply(this, args);
      result?.catch?.(() => {});
      return result;
    };
  }
  return ctx;
}
