// Complete painted leg poses are rasterized together, avoiding the minification
// and clipped quad edges of individually rotated, very narrow leg strips.
export const SPIDER_LEG_FRAMES = 24;
const SPEED = 9;
const TAU = Math.PI * 2;

export function spiderLegFrame(t) {
  return ((Math.round(t * SPEED / TAU * SPIDER_LEG_FRAMES) % SPIDER_LEG_FRAMES) + SPIDER_LEG_FRAMES) % SPIDER_LEG_FRAMES;
}

export function paintedSpiderLegs(frame) {
  const phase = frame / SPIDER_LEG_FRAMES * TAU;
  const legs = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const sway = Math.sin(phase + i * 1.7 + side);
      legs.push({
        shoulder: [side * 6, -7 + i * 4],
        knee: [side * [15, 19, 21, 18][i], [-19, -9, 1, 11][i] + sway * .8],
        foot: [side * ([21, 28, 29, 24][i] + sway * .5), [-15, 1, 15, 28][i] + sway * 1.2],
      });
    }
  }
  return legs;
}
