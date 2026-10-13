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

// Sets the pixels per unit a text is rasterized at, its shadow scaled with it. Phaser's
// setters each redraw the text and upload it again: the style and the padding (fitted to
// whole pixels, see fitPixels) are set here, then the text redrawn once, and not at all
// at the resolution it has.
export function setTextResolution(text, resolution) {
  const { style, padding } = text;
  if (style.resolution === resolution) return text;
  // The size of the lines alone (a text's size is its lines' plus its padding).
  const lines = { width: text.width - padding.left - padding.right, height: text.height - padding.top - padding.bottom };
  style.resolution = resolution;
  const shadow = text.pixiShadow;
  if (shadow) {
    const { shadow: drop, padding: room } = shadowStyle(shadow, resolution);
    Object.assign(style, { shadowOffsetX: drop.offsetX, shadowOffsetY: drop.offsetY, shadowColor: drop.color, shadowBlur: drop.blur, shadowStroke: false, shadowFill: true });
    text.basePadding = room;
  }
  const base = text.basePadding;
  Object.assign(padding, fitted(base, lines.width + base.left + base.right, lines.height + base.top + base.bottom, resolution));
  text.updateText();
  return text;
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
// Every change of padding redraws the text and uploads it again, so it is set only when
// it changes: one redraw for a new text, not three (a stutter in Safari).
function fitPixels(text) {
  const base = text.basePadding;
  const padding = text.padding;
  // The size with the base padding (a text's size is its lines' plus its padding).
  const width = text.width - (padding.left - base.left) - (padding.right - base.right);
  const height = text.height - (padding.top - base.top) - (padding.bottom - base.bottom);
  const target = fitted(base, width, height, text.style.resolution);
  if (Object.keys(target).some((side) => Math.abs(target[side] - padding[side]) > 1e-7)) text.setPadding(target);
}

// The padding that makes a text `width` × `height` units with the base padding `base` a
// whole number of pixels at `resolution`: aimed a hair over the whole pixel, as the
// canvas truncates its size (74.9999 would be 74).
function fitted(base, width, height, resolution) {
  const extra = (size) => (Math.ceil(size * resolution - 1e-6) + 1e-4) / resolution - size;
  return { left: base.left, top: base.top, right: base.right + extra(width), bottom: base.bottom + extra(height) };
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
