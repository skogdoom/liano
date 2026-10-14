// One frame of horizontal exposure, bounded in device pixels. It averages the
// scenery over its travel within a frame, instead of showing only an instant pose.
export const EXPOSURE_PIXELS = 8;
export const EXPOSURE_SAMPLES = 9;

export function exposureWidth(distance, density, dt) {
  // Pauses/resets/stalls should not leave a smeared still image. The distance is
  // unwrapped world motion, so crossing a tile seam cannot create a huge blur.
  if (density <= 0 || dt <= 0 || dt > 0.05 || Math.abs(distance) * density < 0.5) return 0;
  return Math.min(Math.abs(distance), EXPOSURE_PIXELS / density);
}
