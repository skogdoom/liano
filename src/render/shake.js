// Brief screen shake: an offset that wobbles and decays to zero over `duration`.
export class Shake {
  constructor() {
    this.time = 0;
    this.duration = 0;
    this.amplitude = 0;
    this.x = 0;
    this.y = 0;
  }

  trigger(amplitude, duration) {
    this.amplitude = amplitude;
    this.duration = duration;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    if (this.time >= this.duration) {
      this.x = 0;
      this.y = 0;
      return;
    }
    const k = 1 - this.time / this.duration;
    const a = this.amplitude * k * k;
    this.x = a * Math.sin(this.time * 90);
    this.y = a * Math.cos(this.time * 71);
  }
}
