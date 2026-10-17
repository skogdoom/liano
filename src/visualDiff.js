// Comparing generated art or deterministic game frames with their references. The agreed meaning of
// "identical" (PHASER_PLAN.md, section 1): under PARITY.share of the pixels differ by
// more than PARITY.channel (out of 255) in a colour channel, and no more than
// PARITY.solidPerMillion of the pixels are in solid patches of difference.
export const PARITY = { channel: 8, share: 0.01, solidPerMillion: 25 };

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

// How many of the pixels over the limit have all eight neighbours over it too: in a
// solid patch of difference rather than on an edge. Antialiasing differences are rims a
// pixel or two wide and leave next to none; a missing or wrong part leaves a patch, which
// the share alone lets through for a small object on a large picture (PHASER_PLAN.md, M1).
export function solidPixels({ diff }, width) {
  const height = diff.length / 4 / width;
  const over = (x, y) => diff[(y * width + x) * 4 + 1] === 0 && diff[(y * width + x) * 4] === 255;
  let solid = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!over(x, y)) continue;
      let all = true;
      for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1 && all; dx++) all = over(x + dx, y + dy);
      if (all) solid++;
    }
  }
  return solid;
}

// Whether a comparison counts as identical: `result` from compareImages, with `solid`
// from solidPixels (none if left out).
export const passes = ({ share, pixels, solid = 0 }) =>
  share < PARITY.share && (pixels ? (solid / pixels) * 1e6 : 0) <= PARITY.solidPerMillion;
