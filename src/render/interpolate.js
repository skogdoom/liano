// The simulation runs at a fixed rate and the screen at its own. A frame between two sim
// steps draws what is `alpha` (0 to 1) of the way from the previous step's state to the
// current one, so on a screen that is not a multiple of the step rate (90, 144 Hz) the
// motion does not repeat and skip frames.

// Further than this in one step is a jump (a respawn, a new run), not motion: draw it as is.
export const MAX_STEP_JUMP = 30; // px
export const MAX_STEP_TURN = 0.15; // rad

export function blend(prev, cur, alpha, maxJump = MAX_STEP_JUMP) {
  return alpha >= 1 || Math.abs(cur - prev) > maxJump ? cur : prev + (cur - prev) * alpha;
}
