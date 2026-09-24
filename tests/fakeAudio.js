// A small stand-in for the Web Audio API that records what the player does and
// rejects what browsers reject (exponential ramps to zero or below).

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.calls = [];
  }
  setValueAtTime(v, t) {
    this.calls.push(['set', v, t]);
  }
  linearRampToValueAtTime(v, t) {
    this.calls.push(['linear', v, t]);
  }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0)) throw new RangeError(`exponential ramp to ${v}`);
    this.calls.push(['exp', v, t]);
  }
  cancelScheduledValues(t) {
    this.calls.push(['cancel', t]);
  }
}

class FakeNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this.outputs = [];
    this.disconnected = false;
    ctx.nodes.push(this);
  }
  connect(node) {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeSource extends FakeNode {
  constructor(ctx, kind) {
    super(ctx, kind);
    this.started = null;
    this.stops = [];
    this.onended = null;
  }
  start(t) {
    this.started = t;
  }
  stop(t) {
    this.stops.push(t);
  }
  end() {
    this.onended?.();
  }
}

export class FakeAudioContext {
  constructor() {
    this.nodes = [];
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.destination = new FakeNode(this, 'destination');
    this.log = [];
  }
  createGain() {
    const node = new FakeNode(this, 'gain');
    node.gain = new FakeParam(1);
    return node;
  }
  createDynamicsCompressor() {
    return new FakeNode(this, 'compressor');
  }
  createBiquadFilter() {
    const node = new FakeNode(this, 'biquad');
    node.frequency = new FakeParam(350);
    node.Q = new FakeParam(1);
    return node;
  }
  createOscillator() {
    const node = new FakeSource(this, 'oscillator');
    node.frequency = new FakeParam(440);
    return node;
  }
  createBufferSource() {
    return new FakeSource(this, 'bufferSource');
  }
  createBuffer(channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume() {
    this.log.push('resume');
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.log.push('suspend');
    this.state = 'suspended';
    return Promise.resolve();
  }
  sources() {
    return this.nodes.filter((n) => n instanceof FakeSource);
  }
}
