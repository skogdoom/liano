// Plays sound recipes (recipes.js) with the Web Audio API. The only module that
// touches AudioContext.
//
// Browsers only allow audio after a user gesture, so the context is created by
// unlock(), called from input handlers; nothing plays before that. The context is
// suspended while the game is paused or muted. A context that then does not come back
// (the browser or the audio device left it stuck after a window switch) is replaced at
// the next gesture.
//
// The Phaser version plays through Phaser's context and output (phaser/sound.js), with
// the hooks below; their defaults are the Pixi version's own context.

const MASTER_GAIN = 0.6;
const STOP_FADE = 0.05; // s
// A context that should be running but is not (or whose clock stands still) for this long
// is replaced.
const STUCK_MS = 1500;

export class SoundPlayer {
  // `createContext()` gives the context to play on (at the first gesture, and again for
  // each rebuild); `output(ctx)` the node the sounds go to; `closeContext(ctx)` closes a
  // context replaced by a rebuild. `applyMute(muted)`, if given, mutes somewhere else
  // than the player's own gain; `onRun(run)` hears, at every sync, whether the context
  // should be running.
  constructor({
    createContext = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(),
    now = () => performance.now(),
    output = (ctx) => ctx.destination,
    closeContext = (ctx) => ctx.close?.()?.catch?.(() => {}),
    applyMute = null,
    onRun = () => {},
    noiseFor = whiteNoise,
    bufferFor = () => null,
  } = {}) {
    this.createContext = createContext;
    this.now = now;
    this.output = output;
    this.closeContext = closeContext;
    this.applyMute = applyMute;
    this.onRun = onRun;
    this.noiseFor = noiseFor;
    this.bufferFor = bufferFor;
    this.ctx = null;
    this.rebuilds = 0;
    this.played = 0;
    this.stuckSince = null;
    this.lastTime = null;
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
    if (!this.ctx) this.#create();
    this.#sync(true);
  }

  #create() {
    const ctx = this.createContext();
    if (!ctx) return; // Phaser can have no audio manager on this browser.
    this.master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    this.master.connect(compressor);
    compressor.connect(this.output(ctx));
    this.#applyMute();
    this.noise = this.noiseFor(ctx);
    this.ctx = ctx;
    this.stuckSince = null;
    this.lastTime = null;
    // A suspend or resume takes a moment to settle, and the browser can also change the
    // state on its own: whenever it does, bring it back to what the game wants.
    ctx.onstatechange = () => this.#sync();
  }

  // Throws the context away for a new one, and the sounds playing on it.
  #rebuild() {
    const old = this.ctx;
    old.onstatechange = null;
    try {
      this.closeContext(old);
    } catch {
      // Already closed.
    }
    this.active.clear();
    this.rebuilds++;
    this.#create();
  }

  // More for the debug view: whether the clock runs, how many sounds were started, and the
  // output's rate and latency.
  get details() {
    if (!this.ctx) return this.status;
    const { currentTime, sampleRate, outputLatency } = this.ctx;
    const ms = outputLatency === undefined ? '' : `, ${Math.round(outputLatency * 1000)} ms out`;
    return `${this.status}, clock ${currentTime.toFixed(1)} s, ${this.played} played, gain ${this.master.gain.value.toFixed(1)}, ${sampleRate} Hz${ms}`;
  }

  // What the sound is doing, for the debug view.
  get status() {
    if (!this.ctx) return 'locked';
    const { state } = this.ctx;
    return this.rebuilds ? `${state} (rebuilt ${this.rebuilds}x)` : state;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.#applyMute();
    if (muted) this.stopAll();
    this.#sync();
  }

  #applyMute() {
    if (this.applyMute) {
      this.master.gain.value = MASTER_GAIN;
      this.applyMute(this.muted);
    } else this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
  }

  // Called every frame, so a resume the browser refused is tried again.
  setPaused(paused) {
    this.paused = paused;
    this.#sync();
  }

  // Starts a recipe now. Returns false if it could not play (locked, muted, paused).
  play(recipe) {
    const { ctx } = this;
    if (!ctx || this.muted || this.paused) return false;
    const t0 = ctx.currentTime;
    const sound = { name: recipe.name, outputs: [], sources: [] };
    const buffer = this.bufferFor(recipe);
    const voices = buffer ? [{ source: { kind: 'buffer', buffer }, gain: [{ t: 0, v: 1, ramp: 'set' }] }] : recipe.voices;
    let running = voices.length;
    for (const voice of voices) {
      const { out, source } = recipeVoice(ctx, voice, this.master, t0, this.noise);

      source.start(t0);
      source.stop(t0 + recipe.duration);
      source.onended = () => {
        out.disconnect();
        if (--running === 0) this.active.delete(sound);
      };
      sound.outputs.push(out);
      sound.sources.push(source);
    }
    this.active.add(sound);
    this.played++;
    return true;
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

  // Whether the context has been stuck for STUCK_MS while it should be running: not in the
  // 'running' state, or running with its clock standing still.
  #stuck(ctx) {
    const idle = ctx.state !== 'running' || ctx.currentTime === this.lastTime;
    this.lastTime = ctx.currentTime;
    if (!idle) {
      this.stuckSince = null;
      return false;
    }
    const now = this.now();
    this.stuckSince ??= now;
    return now - this.stuckSince >= STUCK_MS;
  }

  // Runs the context only while unmuted and unpaused. Anything but 'running' (also
  // 'interrupted', which Safari reports) is brought back; a suspend still settling when
  // the game resumes is caught by the state change it ends in.
  #sync(gesture = false) {
    const { ctx } = this;
    if (!ctx) return;
    const run = !this.muted && !this.paused;
    this.onRun(run);
    if (!run) {
      this.stuckSince = null;
      this.lastTime = null;
    }
    // A new context is only allowed to start from a gesture, so a stuck one is replaced
    // by the next.
    if (run && this.#stuck(ctx) && gesture) {
      this.#rebuild();
      return this.#sync();
    }
    // Both can reject (e.g. audio still not allowed); the next frame or gesture tries again.
    if (run && ctx.state !== 'running') ctx.resume()?.catch?.(() => {});
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

export function whiteNoise(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// The dry recipe graph, shared by live synthesis and Phaser's startup rendering.
// Master gain and compression stay live, so overlapping cached sounds mix as before.
export function recipeVoice(ctx, voice, destination, t0, noise) {
  const out = ctx.createGain();
  out.gain.value = 0;
  schedule(out.gain, voice.gain, t0);
  out.connect(destination);
  const spec = voice.source;
  const source = spec.kind === 'osc' ? ctx.createOscillator() : ctx.createBufferSource();
  if (spec.kind === 'osc') {
    source.type = spec.wave;
    schedule(source.frequency, spec.freq, t0);
  } else {
    source.buffer = spec.kind === 'noise' ? noise : spec.buffer;
    source.loop = spec.kind === 'noise';
  }
  let node = source;
  for (const f of voice.filters ?? []) {
    const filter = biquad(ctx, f.type, f.q, f.freq, t0);
    node.connect(filter);
    node = filter;
  }
  node.connect(out);
  return { out, source };
}
