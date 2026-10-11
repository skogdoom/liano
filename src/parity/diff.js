// Comparing the two versions' pictures of the same scenario. The agreed meaning of
// "identical" (PHASER_PLAN.md, section 1): under PARITY.share of the pixels differ by
// more than PARITY.channel (out of 255) in a colour channel.
export const PARITY = { channel: 8, share: 0.01 };

// `a` and `b` are the RGBA bytes of two images of the same size. Returns how many
// pixels differ by more than `channel` in any channel (alpha included), their share,
// the largest difference, and a picture of the differences: red where a pixel is over
// the limit, grey (brighter for larger) where it differs by less.
export function compareImages(a, b, { channel = PARITY.channel } = {}) {
  if (a.length !== b.length || a.length % 4 !== 0) throw new Error('compareImages: the images differ in size');
  const pixels = a.length / 4;
  const diff = new Uint8ClampedArray(a.length);
  let differing = 0;
  let maxDelta = 0;
  for (let i = 0; i < a.length; i += 4) {
    let delta = 0;
    for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(a[i + c] - b[i + c]));
    maxDelta = Math.max(maxDelta, delta);
    if (delta > channel) {
      differing++;
      diff[i] = 255;
    } else {
      diff[i] = diff[i + 1] = diff[i + 2] = Math.min(delta * 16, 160);
    }
    diff[i + 3] = 255;
  }
  return { pixels, differing, share: pixels ? differing / pixels : 0, maxDelta, diff };
}

// Whether a comparison counts as identical.
export const passes = (result, share = PARITY.share) => result.share < share;
