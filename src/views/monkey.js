// The monkey: what both versions draw from (no Pixi here). Colours, sizes, the drawing
// functions (the Pixi view draws with them, and the art pieces are generated from them),
// and where things go and how they move. The Pixi view is render/monkeyView.js.

// The body and head fit inside the MONKEY_RADIUS hitbox circle; only the limbs, ears
// and tail reach outside it. Local +y is down, and the monkey faces +x (mirrored when
// travelling left).

// Fur per player: player 1 brown, player 2 ginger.
export const PALETTES = [
  { fur: 0x6e4322, furDark: 0x4a2c14, skin: 0xe0ad74 },
  { fur: 0xb8672a, furDark: 0x7f3f14, skin: 0xf0c890 },
];
export const INVULNERABLE_BLINK = 10; // Hz
export const EYE = 0x1c1008;

// Where the gripping hand holds the liana, above the head along the rope.
export const GRIP_HAND = { x: 0, y: -25 };
export const SHOULDER = { x: 7, y: -1 };
// The limbs' pivots (shoulders and hips), and their lengths and widths.
export const LIMBS = {
  armBack: { x: -SHOULDER.x, y: SHOULDER.y },
  armFront: { x: SHOULDER.x, y: SHOULDER.y },
  legBack: { x: -6, y: 15 },
  legFront: { x: 6, y: 15 },
};
export const ARM = { length: 21, width: 5 };
export const LEG = { length: 12, width: 6 };
// Body tilt behind the swing, per unit of angular speed (fraction of full speed).
export const HANG_LAG = 0.15;
export const ROTATION_EASE = 14; // 1/s
export const DEAD_SPIN = 7; // rad/s

// A limb drawn pointing down (+y) from its pivot; rotation swings it around.
export function drawLimb(g, { length, width }, color, endColor) {
  return g.moveTo(0, 0).lineTo(0, length).stroke({ width, color, cap: 'round' }).circle(0, length, width * 0.7).fill(endColor);
}
export const drawArm = (g, { fur, skin }) => drawLimb(g, ARM, fur, skin);
export const drawLeg = (g, { fur, furDark }) => drawLimb(g, LEG, fur, furDark);

// The monkey's parts, each drawn on its own (also as pieces for the Phaser version), in
// the colours of a palette (PALETTES, or the shadow's).
export function drawMonkeyTail(g, { furDark }) {
  return g
    .moveTo(-8, 14)
    .bezierCurveTo(-24, 24, -34, 6, -26, -5)
    .bezierCurveTo(-21, -12, -12, -8, -16, -2)
    .stroke({ width: 4, color: furDark, cap: 'round' });
}

export function drawTorso(g, { fur, skin }) {
  return g.ellipse(0, 6, 13, 14).fill(fur).ellipse(0, 9, 8, 9).fill(skin);
}

export function drawMonkeyHead(g, { fur, skin }) {
  return g
    .circle(-11, -14, 5)
    .fill(fur)
    .circle(11, -14, 5)
    .fill(fur)
    .circle(-11, -14, 2.5)
    .fill(skin)
    .circle(11, -14, 2.5)
    .fill(skin)
    .circle(0, -10, 11)
    .fill(fur)
    .ellipse(0, -8, 8, 7)
    .fill(skin)
    .ellipse(0, -4.5, 4.5, 3)
    .fill(0xf0c894)
    .circle(-1.3, -5.5, 0.8)
    .fill(EYE)
    .circle(1.3, -5.5, 0.8)
    .fill(EYE);
}

export function drawMonkeyEyes(g) {
  return g.circle(-3.5, -11, 1.8).fill(EYE).circle(3.5, -11, 1.8).fill(EYE);
}

export function drawDeadEyes(g) {
  return g
    .moveTo(-5.5, -13)
    .lineTo(-1.5, -9)
    .moveTo(-1.5, -13)
    .lineTo(-5.5, -9)
    .moveTo(1.5, -13)
    .lineTo(5.5, -9)
    .moveTo(5.5, -13)
    .lineTo(1.5, -9)
    .stroke({ width: 1.6, color: EYE, cap: 'round' });
}

// Rotation that points a downward limb from `from` towards `to`.
export function aim(from, to) {
  return Math.atan2(-(to.x - from.x), to.y - from.y);
}

export const POSES = {
  // Front arm grips the rope above the head, back arm and legs hang loose.
  hanging: { armBack: 0.35, armFront: aim(SHOULDER, GRIP_HAND), legBack: 0.12, legFront: -0.12 },
  // Arms and legs spread.
  airborne: { armBack: 2.1, armFront: -2.1, legBack: 0.6, legFront: -0.6 },
  dead: { armBack: 2.7, armFront: -2.7, legBack: 0.9, legFront: -0.9 },
};
