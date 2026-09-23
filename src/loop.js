// Fixed-timestep accumulator. `advance` is fed real frame time; `step` runs at a fixed dt.

export function createFixedStepLoop({ step, dt, maxFrameDt }) {
  let accumulator = 0;

  return {
    // Returns the interpolation factor in [0, 1) between the last two sim steps.
    advance(frameDt) {
      accumulator += Math.min(Math.max(frameDt, 0), maxFrameDt);
      while (accumulator >= dt) {
        step(dt);
        accumulator -= dt;
      }
      return accumulator / dt;
    },
  };
}
