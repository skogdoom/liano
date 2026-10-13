import { BONG_PITCH, bong, crash, lifeUp, pling } from '../audio/recipes.js';
import { recipeVoice, whiteNoise } from '../audio/player.js';

const keyOf = (recipe) => JSON.stringify(recipe);

// All fifteen game sounds, rendered once during loading. No compressor here: the
// player's live compressor still processes their combined signal when they overlap.
export class SoundCache {
  constructor(ctx, { createOffline = (rate, length) => new (globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext)(1, length, rate) } = {}) {
    this.rate = ctx.sampleRate;
    this.noise = whiteNoise(ctx);
    this.createOffline = createOffline;
    this.buffers = new Map();
  }

  prepare() {
    return this.ready ??= this.#prepare();
  }

  async #prepare() {
    const recipes = [...Object.keys(BONG_PITCH).map(bong), crash(), pling(), lifeUp()];
    try {
      // One offline context at a time also keeps startup memory bounded on iOS.
      for (const recipe of recipes) {
        const ctx = this.createOffline(this.rate, Math.ceil(recipe.duration * this.rate));
        for (const voice of recipe.voices) {
          const { source } = recipeVoice(ctx, voice, ctx.destination, 0, this.noise);
          source.start(0);
          source.stop(recipe.duration);
        }
        this.buffers.set(keyOf(recipe), await ctx.startRendering());
      }
    } catch {
      // Offline audio is optional; normal synthesis still works if unavailable.
      this.buffers.clear();
    }
    return this.buffers.size;
  }

  get(recipe) {
    return this.buffers.get(keyOf(recipe)) ?? null;
  }

  get bytes() {
    return this.noise.length * 4 + [...this.buffers.values()].reduce((n, b) => n + b.length * b.numberOfChannels * 4, 0);
  }
}
