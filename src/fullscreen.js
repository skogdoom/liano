// Full screen for the whole page (so the HTML overlays stay visible), through the
// Fullscreen API or its webkit-prefixed form in older Safari. iPhone Safari has no
// Fullscreen API for pages: `supported` is false there.

export function createFullscreen(doc, { onChange = () => {} } = {}) {
  const root = doc.documentElement;
  const request = root.requestFullscreen ?? root.webkitRequestFullscreen;
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  const supported = Boolean(enabled && request && exit);
  const isActive = () => Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);

  const changed = () => onChange(isActive());
  const events = ['fullscreenchange', 'webkitfullscreenchange'];
  for (const type of events) doc.addEventListener(type, changed);

  return {
    supported,
    get active() {
      return isActive();
    },
    // Must run inside a user gesture. A refused request (no gesture, or a browser
    // policy) is ignored: the state simply does not change.
    toggle() {
      if (!supported) return;
      try {
        const result = isActive() ? exit.call(doc) : request.call(root);
        result?.catch?.(() => {});
      } catch {
        // Older webkit throws instead of rejecting.
      }
    },
    destroy() {
      for (const type of events) doc.removeEventListener(type, changed);
    },
  };
}

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
