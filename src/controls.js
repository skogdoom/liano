// The on-screen buttons' places, for both versions. They sit in the top-left corner
// inside the safe area, scaled by the layout's `ui` (see layout.js).

// Tap targets in the buttons' own coordinates (logical pixels).
export const MUTE_HIT = { x: 0, y: 0, w: 90, h: 90 };
export const FULLSCREEN_HIT = { x: 90, y: 0, w: 90, h: 90 };

export const inside = (hit, { x, y }) => x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h;

// Where a pointer at (`clientX`, `clientY`) is in the buttons' coordinates, for the
// canvas at `rect` (its bounding client rect) under `layout`.
export function controlsPoint(layout, rect, clientX, clientY) {
  const x = (clientX - rect.left - layout.x) / layout.scale;
  const y = (clientY - rect.top - layout.y) / layout.scale;
  return { x: (x - layout.insets.left) / layout.ui, y: (y - layout.insets.top) / layout.ui };
}
