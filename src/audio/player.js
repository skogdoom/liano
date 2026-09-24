// Plays sound recipes (recipes.js) with the Web Audio API. The only module that
// touches AudioContext.
//
// Browsers only allow audio after a user gesture, so the context is created by
// unlock(), called from input handlers; nothing plays before that. The context is
// suspended while the game is paused or muted.

const MASTER_GAIN = 0.6;
const STOP_FADE = 0.05; // s

export class SoundPlayer {
  constructor({ createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)() } = {}) {
    this.createContext = createContext;
    this.ctx = null;
    this.muted = false;
    this.paused = false;
    // Sounds still playing: { name, outputs, sources }.
    this.active = new Set();
  }

  get unlocked() {
    return this.ctx !== null;
  }

  // Call from a user gesture. Creates the context the first time, and resumes it if
  // the browser suspended it (e.g. iOS after a phone call).
  unlock() {
    if (!this.ctx) {
      const ctx = this.createContext();
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      const compressor = ctx.createDynamicsCompressor();
      this.master.connect(compressor);
      compressor.connect(ctx.destination);
      this.noise = whiteNoise(ctx);
      this.ctx = ctx;
    }
    this.#sync();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : MASTER_GAIN;
    if (muted) this.stopAll();
    this.#sync();
  }

  setPaused(paused) {
    if (paused === this.paused) return;
    this.paused = paused;
    this.#sync();
  }

  // Starts a recipe now. Returns false if it could not play (locked, muted, paused).
  play(recipe) {
    const { ctx } = this;
    if (!ctx || this.muted || this.paused) return false;
    const t0 = ctx.currentTime;
    const sound = { name: recipe.name, outputs: [], sources: [] };
    let running = recipe.voices.length;
    for (const voice of recipe.voices) {
      const out = ctx.createGain();
      out.gain.value = 0;
      schedule(out.gain, voice.gain, t0);
      out.connect(this.master);

      const { source, extras } = this.#source(voice.source, t0, recipe.duration);
      let node = source;
      for (const f of voice.filters ?? []) {
        const filter = biquad(ctx, f.type, f.q, f.freq, t0);
        node.connect(filter);
        node = filter;
      }
      if (voice.formants) {
        for (const f of voice.formants) {
          const filter = biquad(ctx, 'bandpass', f.q, f.freq, t0);
          const level = ctx.createGain();
          level.gain.value = 0;
          schedule(level.gain, f.gain, t0);
          node.connect(filter);
          filter.connect(level);
          level.connect(out);
        }
      } else {
        node.connect(out);
      }

      for (const s of [source, ...extras]) {
        s.start(t0);
        s.stop(t0 + recipe.duration);
      }
      source.onended = () => {
        out.disconnect();
        if (--running === 0) this.active.delete(sound);
      };
      sound.outputs.push(out);
      sound.sources.push(source, ...extras);
    }
    this.active.add(sound);
    return true;
  }

  // Fades out and stops every playing sound called `name`.
  stop(name) {
    for (const sound of this.active) if (sound.name === name) this.#fadeOut(sound);
  }

  stopAll() {
    for (const sound of this.active) this.#fadeOut(sound);
  }

  #fadeOut(sound) {
    const now = this.ctx.currentTime;
    for (const out of sound.outputs) {
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + STOP_FADE);
    }
    for (const s of sound.sources) stopSafely(s, now + STOP_FADE);
  }

  // Oscillator (with optional vibrato LFO) or looping noise.
  #source(spec, t0) {
    const { ctx } = this;
    if (spec.kind === 'noise') {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noise;
      noise.loop = true;
      return { source: noise, extras: [] };
    }
    const osc = ctx.createOscillator();
    osc.type = spec.wave;
    schedule(osc.frequency, spec.freq, t0);
    if (!spec.vibrato) return { source: osc, extras: [] };
    const lfo = ctx.createOscillator();
    lfo.frequency.value = spec.vibrato.rate;
    const depth = ctx.createGain();
    depth.gain.value = spec.vibrato.depth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    return { source: osc, extras: [lfo] };
  }

  // Runs the context only while unmuted and unpaused.
  #sync() {
    const { ctx } = this;
    if (!ctx) return;
    const run = !this.muted && !this.paused;
    // Both can reject (e.g. audio still not allowed); the next gesture tries again.
    if (run && ctx.state === 'suspended') ctx.resume()?.catch?.(() => {});
    else if (!run && ctx.state === 'running') ctx.suspend()?.catch?.(() => {});
  }
}

// Applies an envelope (see recipes.js) to an AudioParam, starting at t0.
export function schedule(param, envelope, t0) {
  for (const { t, v, ramp } of envelope) {
    if (ramp === 'set') param.setValueAtTime(v, t0 + t);
    else if (ramp === 'linear') param.linearRampToValueAtTime(v, t0 + t);
    else param.exponentialRampToValueAtTime(v, t0 + t);
  }
}

// Older Safari throws when stop() is called a second time.
function stopSafely(source, when) {
  try {
    source.stop(when);
  } catch {
    // Already stopped: nothing to do.
  }
}

function biquad(ctx, type, q, freq, t0) {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  schedule(filter.frequency, freq, t0);
  return filter;
}

function whiteNoise(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
