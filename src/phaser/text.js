// Text in the Phaser version, laid out as the Pixi version lays it out (PHASER_PLAN.md,
// M5c): Pixi measures a font's height on '|ÉqÅM', Phaser on '|MÉqgy' by default, so the
// same text came out a pixel taller or shorter and, centred, half a pixel off. Phaser
// also rounds a text's width up, where Pixi centres on the measured width.
export const PIXI_TEST_STRING = '|ÉqÅM';

const css = (color) => `#${color.toString(16).padStart(6, '0')}`;

// A Phaser text style from the parts the game uses: the font (`size` px, `weight`), its
// fill and stroke colours (0xRRGGBB) and the stroke's width, how lines align, a drop
// shadow as Pixi's (`shadow`: { color, alpha, distance, blur, angle }), and the pixels per
// unit to rasterize it at.
export function textStyle({ family = 'sans-serif', size, weight = 'normal', fill, stroke = null, strokeWidth = 0, align = 'left', shadow = null, resolution = 1 }) {
  return {
    fontFamily: family,
    fontSize: `${size}px`,
    fontStyle: weight,
    color: css(fill),
    align,
    ...(stroke !== null && { stroke: css(stroke), strokeThickness: strokeWidth }),
    ...(shadow && shadowStyle(shadow, resolution)),
    resolution,
    testString: PIXI_TEST_STRING,
  };
}

// A drop shadow as Pixi draws one: the canvas's shadow, `distance` units at `angle`,
// blurred `blur`. A canvas shadow ignores the canvas's scale, so its offset and blur are
// in pixels: scaled here by the resolution, as Pixi scales them. The text gets room round
// it for the shadow (Phaser would cut it off at its edges).
function shadowStyle({ color, alpha, distance, blur, angle }, resolution) {
  const [r, g, b] = [16, 8, 0].map((shift) => (color >> shift) & 255);
  // Whole pixels at the resolution, so the glyphs fall on the pixels as Pixi's do (Pixi
  // draws them at its canvas's edge).
  const room = Math.ceil(Math.ceil(distance + blur) * resolution) / resolution;
  return {
    shadow: {
      offsetX: Math.cos(angle) * distance * resolution,
      offsetY: Math.sin(angle) * distance * resolution,
      color: `rgba(${r}, ${g}, ${b}, ${alpha})`,
      blur: blur * resolution,
      stroke: false,
      fill: true,
    },
    padding: { left: room, right: room, top: room, bottom: room },
  };
}

// A text (not yet on the display list) in the style `options` describes (see textStyle).
export function makeText(scene, content, options) {
  const text = scene.make.text({ x: 0, y: 0, text: content, style: textStyle(options) }, false);
  text.pixiShadow = options.shadow ?? null;
  text.basePadding = { ...text.padding };
  // Pixi draws a line where it falls (half a stroke in); Phaser would round it to a pixel.
  text.autoRound = false;
  return text;
}

// The pixels per unit to rasterize a text at, drawn at `scale` on a screen of `zoom`
// device pixels per unit: the screen's density, times the scale when it is enlarged (a
// smaller text is drawn at full size and shrunk, as Pixi draws it).
export const textResolution = (zoom, scale = 1) => zoom * Math.max(scale, 1);

// Sets the pixels per unit a text is rasterized at, its shadow scaled with it.
export function setTextResolution(text, resolution) {
  const shadow = text.pixiShadow;
  if (shadow) {
    const style = shadowStyle(shadow, resolution);
    const { offsetX, offsetY, color, blur } = style.shadow;
    text.basePadding = style.padding;
    text.setShadow(offsetX, offsetY, color, blur, false, true).setPadding(style.padding);
  }
  return text.setResolution(resolution);
}

// A line's width as Pixi measures it: the larger of its advance and the width its glyphs
// actually cover (a bold glyph can reach past its advance).
function pixiLineWidth(context, line) {
  const metrics = context.measureText(line);
  const bounds = (metrics.actualBoundingBoxRight ?? 0) + (metrics.actualBoundingBoxLeft ?? 0);
  return Math.max(metrics.width, bounds);
}

// Makes a text a whole number of pixels across and down at its resolution: its canvas can
// only be whole pixels, and at a resolution like 1.8 Phaser's own size would leave the
// canvas a fraction of a pixel smaller than the texture it draws, stretching the text.
// The fraction goes into the padding at the right and bottom, which moves nothing.
function fitPixels(text) {
  const base = text.basePadding;
  const { left, top, right, bottom } = text.padding;
  if (left !== base.left || top !== base.top || right !== base.right || bottom !== base.bottom) text.setPadding(base);
  const resolution = text.style.resolution;
  // A hair over the whole pixel: the canvas truncates its size, and 74.9999 would be 74.
  const extra = (size) => (Math.ceil(size * resolution - 1e-6) + 1e-4) / resolution - size;
  const [dw, dh] = [extra(text.width), extra(text.height)];
  if (dw || dh) text.setPadding(base.left, base.top, base.right + dw, base.bottom + dh);
}

// Sets a text's origin as a share of its size, as Pixi anchors a text: on its texture,
// which is the text's measured size rounded up to whole units, then to whole pixels at
// its resolution. Pixi
// measures across the larger of a line's advance and its glyphs' reach (with the stroke),
// rather than Phaser's rounded-up width, and with a shadow adds its distance to the width
// and height. The room Phaser keeps for the shadow (padding) is left out. `pixiWidth`
// keeps the measured width (Pixi's `width`).
export function setTextOrigin(text, x = 0.5, y = 0.5) {
  fitPixels(text);
  const lines = String(text.text).split('\n');
  const distance = text.pixiShadow?.distance ?? 0;
  const measured = Math.max(...lines.map((line) => pixiLineWidth(text.context, line))) + (text.style.strokeThickness ?? 0) + distance;
  const { left, top } = text.padding;
  const inner = text.height - top - text.padding.bottom;
  const resolution = text.style.resolution;
  const texture = (size) => Math.ceil(Math.ceil(size) * resolution) / resolution;
  text.pixiWidth = measured;
  return text.setOrigin((left + x * texture(measured)) / text.width, (top + y * texture(inner + distance)) / text.height);
}
