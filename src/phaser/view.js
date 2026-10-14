// How the Phaser version puts the logical view on the screen (PHASER_PLAN.md, M1 report:
// the HiDPI method). Phaser has no resolution setting: the canvas has `ratio` device
// pixels per CSS pixel and is shown at its CSS size, and each camera zooms by the
// layout's scale times the ratio. Pure, so it is tested in Node.

export { resolutionLimit } from './resolution.js';

// The canvas size in device pixels for a window of `width` × `height` CSS pixels.
export const canvasSize = (width, height, ratio) => ({ width: Math.round(width * ratio), height: Math.round(height * ratio) });

// The camera that shows the logical view (see layout.js) on that canvas: its viewport
// in canvas pixels, its zoom, and its scroll (in view units, for an origin at the top
// left). The viewport snaps to whole pixels, as a camera's clip does; the scroll keeps
// the view's origin exactly where the layout puts it, as the Pixi version draws it.
// Outside the viewport is the game's black background: the letterbox bars.
export function viewCamera(layout, ratio) {
  const { x, y, scale, view } = layout;
  const left = Math.round(x * ratio);
  const top = Math.round(y * ratio);
  const right = Math.round((x + view.width * scale) * ratio);
  const bottom = Math.round((y + view.height * scale) * ratio);
  const zoom = scale * ratio;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    zoom,
    scrollX: (left - x * ratio) / zoom,
    scrollY: (top - y * ratio) / zoom,
  };
}

// The camera for a rect of the view (`rect`: x, y, width and height in view units), on
// the canvas as `placement` (a viewCamera) puts the view: its viewport covers the rect,
// snapped to whole pixels, so it clips to it; zoom and scroll draw every view point
// where `placement` does.
export function rectCamera(placement, rect) {
  const { zoom } = placement;
  // Rounded as viewCamera rounds (the float error trimmed first: an edge on a half pixel
  // must land on the view's own edge).
  const at = (v, origin, scroll) => Math.round(Number((origin + (v - scroll) * zoom).toFixed(6)));
  const left = at(rect.x, placement.x, placement.scrollX);
  const top = at(rect.y, placement.y, placement.scrollY);
  const right = at(rect.x + rect.width, placement.x, placement.scrollX);
  const bottom = at(rect.y + rect.height, placement.y, placement.scrollY);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    zoom,
    scrollX: placement.scrollX + (left - placement.x) / zoom,
    scrollY: placement.scrollY + (top - placement.y) / zoom,
  };
}

// Points `camera` (a Phaser camera) at the view as `viewCamera` places it.
export function applyViewCamera(camera, placement) {
  camera
    .setViewport(placement.x, placement.y, placement.width, placement.height)
    .setOrigin(0, 0)
    .setZoom(placement.zoom)
    .setScroll(placement.scrollX, placement.scrollY);
  return camera;
}
