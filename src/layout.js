import {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  WORLD_HEIGHT,
  CAMERA_TARGET_X,
  MIN_VISIBLE_WORLD_HEIGHT,
  MAX_VIEW_WIDTH,
  PORTRAIT_VIEW_WIDTH,
  PORTRAIT_ANCHOR_X,
  PORTRAIT_SPARE_ABOVE,
  MIN_UI_CSS_SCALE,
  MAX_UI_SCALE,
} from './config.js';

// Half the height of the tallest panel (game over), plus a little.
const PANEL_HALF_HEIGHT = 175;

// Where everything goes for a screen of `width` × `height` CSS pixels. Pure, so every
// screen shape can be unit-tested.
//
// The game draws in a logical view of `view.width` × `view.height`, scaled by `scale`
// (CSS pixels per logical pixel) and placed at (`x`, `y`) CSS pixels; any space around
// it gets black bars. The world band (world y 0 to WORLD_HEIGHT) starts at `bandTop`
// in the view.
//
// - Landscape at 16:9: the 1280 × 720 frame, exactly as designed.
// - Landscape wider than 16:9 (a phone showing its browser bars): crop the empty
//   bottom of the band down to MIN_VISIBLE_WORLD_HEIGHT, then show more world to the
//   side up to MAX_VIEW_WIDTH, then bars.
// - Landscape narrower than 16:9 (a 4:3 iPad): extra canopy above and undergrowth
//   below the band.
// - Portrait: PORTRAIT_VIEW_WIDTH of world, with the spare height split above and
//   below the band; the panels go below it.
//
// `insets` are the safe-area insets (notch, home indicator) in CSS pixels.
export function layoutFor(width, height, insets = { top: 0, right: 0, bottom: 0, left: 0 }) {
  const aspect = width / height;
  const portrait = aspect < 1;
  let viewWidth;
  let viewHeight;
  let bandTop = 0;

  if (portrait) {
    viewWidth = PORTRAIT_VIEW_WIDTH;
    viewHeight = viewWidth / aspect;
    bandTop = (viewHeight - WORLD_HEIGHT) * PORTRAIT_SPARE_ABOVE;
  } else if (aspect <= SCREEN_WIDTH / SCREEN_HEIGHT) {
    viewWidth = SCREEN_WIDTH;
    viewHeight = viewWidth / aspect;
    bandTop = (viewHeight - WORLD_HEIGHT) / 2;
  } else {
    viewHeight = Math.max(SCREEN_WIDTH / aspect, MIN_VISIBLE_WORLD_HEIGHT);
    viewWidth = Math.min(viewHeight * aspect, MAX_VIEW_WIDTH);
  }

  const scale = Math.min(width / viewWidth, height / viewHeight);
  const x = (width - viewWidth * scale) / 2;
  const y = (height - viewHeight * scale) / 2;
  const ui = portrait ? Math.min(Math.max(MIN_UI_CSS_SCALE / scale, 1), MAX_UI_SCALE) : 1;
  // Insets in logical pixels, less whatever the bars already keep clear.
  const inset = (css, bar) => Math.max(css - bar, 0) / scale;

  // Panels: landscape keeps the designed spots (the title right of the swing);
  // portrait centres them in the space below the band, kept on screen.
  const bandBottom = bandTop + WORLD_HEIGHT;
  const landscapePanelY = bandTop + SCREEN_HEIGHT / 2 - 20;
  const belowBand = Math.min(bandBottom + (viewHeight - bandBottom) / 2, viewHeight - 16 - PANEL_HALF_HEIGHT * ui);
  const panelY = portrait ? belowBand : landscapePanelY;

  return {
    orientation: portrait ? 'portrait' : 'landscape',
    scale,
    x,
    y,
    view: { width: viewWidth, height: viewHeight },
    bandTop,
    // How far the floor is lifted to stay at the bottom edge when the band is cropped.
    floorShift: Math.min(viewHeight - bandBottom, 0),
    ui,
    insets: {
      top: inset(insets.top, y),
      right: inset(insets.right, x),
      bottom: inset(insets.bottom, y),
      left: inset(insets.left, x),
    },
    // The camera keeps `follow` ('monkey', or the anchor of the liana it hangs on) at
    // `screenX` in the view.
    camera: portrait
      ? { follow: 'anchor', screenX: PORTRAIT_ANCHOR_X * viewWidth }
      : { follow: 'monkey', screenX: CAMERA_TARGET_X },
    panels: {
      title: { x: portrait ? viewWidth / 2 : viewWidth - (SCREEN_WIDTH - 990), y: panelY },
      gameOver: { x: viewWidth / 2, y: panelY },
      paused: { x: viewWidth / 2, y: viewHeight / 2 },
    },
  };
}
