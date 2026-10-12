// Text in the Phaser version, laid out as the Pixi version lays it out (PHASER_PLAN.md,
// M5c): Pixi measures a font's height on '|ÉqÅM', Phaser on '|MÉqgy' by default, so the
// same text came out a pixel taller or shorter and, centred, half a pixel off. Phaser
// also rounds a text's width up, where Pixi centres on the measured width.
export const PIXI_TEST_STRING = '|ÉqÅM';

const css = (color) => `#${color.toString(16).padStart(6, '0')}`;

// A Phaser text style from the parts the game uses: the font (`size` px, `weight`), its
// fill and stroke colours (0xRRGGBB) and the stroke's width, and the pixels per unit to
// rasterize it at.
export function textStyle({ family = 'sans-serif', size, weight = 'normal', fill, stroke = null, strokeWidth = 0, resolution = 1 }) {
  return {
    fontFamily: family,
    fontSize: `${size}px`,
    fontStyle: weight,
    color: css(fill),
    ...(stroke !== null && { stroke: css(stroke), strokeThickness: strokeWidth }),
    resolution,
    testString: PIXI_TEST_STRING,
  };
}

// Sets a text's origin as a share of its size, measured as Pixi measures it: across, the
// text's measured width (with its stroke) rather than Phaser's rounded-up one.
export function setTextOrigin(text, x = 0.5, y = 0.5) {
  const lines = String(text.text).split('\n');
  const measured = Math.max(...lines.map((line) => text.context.measureText(line).width)) + (text.style.strokeThickness ?? 0);
  return text.setOrigin((x * measured) / text.width, y);
}
