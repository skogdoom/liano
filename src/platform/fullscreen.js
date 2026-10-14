// Phaser.Scale.Events.ENTER_FULLSCREEN and LEAVE_FULLSCREEN (Phaser can't load in Node,
// where this is tested; a browser test checks the names).
export const ENTER_FULLSCREEN = 'enterfullscreen';
export const LEAVE_FULLSCREEN = 'leavefullscreen';

// Full screen through Phaser's Scale Manager, with the same interface as fullscreen.js
// (`supported`, `active`, `toggle()`, `onChange`), so the F key and the button's
// pointerup rule (bindFullscreenControls) work as in the Pixi version. The whole page
// goes full screen (the game's config sets `fullscreenTarget` to the document's root),
// so the HTML overlays stay visible. iPhone Safari has no Fullscreen API for pages.
//
// Phaser does not handle a refused request (its promise would reach the error screen),
// so entering is requested here, on Phaser's own target, with the refusal ignored;
// Phaser still sees the change and resizes.
export function createPhaserFullscreen(scale, { onChange = () => {} } = {}) {
  const { fullscreen } = scale;
  const supported = Boolean(fullscreen.available);
  const entered = () => onChange(true);
  const left = () => onChange(false);
  scale.on(ENTER_FULLSCREEN, entered);
  scale.on(LEAVE_FULLSCREEN, left);
  return {
    supported,
    get active() {
      return Boolean(fullscreen.active);
    },
    // Must run inside a user gesture.
    toggle() {
      if (!supported) return;
      if (fullscreen.active) {
        scale.stopFullscreen();
        return;
      }
      try {
        const target = scale.getFullscreenTarget();
        target[fullscreen.request]({ navigationUI: 'hide' })?.catch?.(() => {});
      } catch {
        // Older webkit throws instead of rejecting.
      }
    },
    destroy() {
      scale.off(ENTER_FULLSCREEN, entered);
      scale.off(LEAVE_FULLSCREEN, left);
    },
  };
}
