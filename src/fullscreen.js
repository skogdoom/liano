// F toggles full screen (not with Ctrl, Alt or Cmd, which are browser shortcuts). A
// tap on the button toggles on release: touch browsers allow entering full screen
// from pointerup but not from a touch pointerdown. `hit(event)` says whether a
// pointer event is on the button; the pointerdown itself must also be kept from
// counting as a game press (the input's `intercept`).
export function bindFullscreenControls(keyTarget, pointerTarget, fullscreen, { hit }) {
  const downs = new Set();
  const onKeyDown = (event) => {
    if (event.code !== 'KeyF' || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    fullscreen.toggle();
  };
  const onPointerDown = (event) => {
    if (hit(event)) downs.add(event.pointerId);
  };
  const onPointerUp = (event) => {
    if (downs.delete(event.pointerId) && hit(event)) fullscreen.toggle();
  };
  const onPointerCancel = (event) => downs.delete(event.pointerId);

  keyTarget.addEventListener('keydown', onKeyDown);
  pointerTarget.addEventListener('pointerdown', onPointerDown);
  pointerTarget.addEventListener('pointerup', onPointerUp);
  pointerTarget.addEventListener('pointercancel', onPointerCancel);
  return {
    destroy() {
      keyTarget.removeEventListener('keydown', onKeyDown);
      pointerTarget.removeEventListener('pointerdown', onPointerDown);
      pointerTarget.removeEventListener('pointerup', onPointerUp);
      pointerTarget.removeEventListener('pointercancel', onPointerCancel);
    },
  };
}
