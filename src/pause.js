// Pauses the game while the window is unfocused or the page is hidden. Starts
// unpaused: some browsers report no focus until the first interaction.
export function createFocusPause(win, doc) {
  let blurred = false;
  let hidden = doc.visibilityState === 'hidden';

  const onBlur = () => (blurred = true);
  const onFocus = () => (blurred = false);
  const onVisibility = () => (hidden = doc.visibilityState === 'hidden');

  win.addEventListener('blur', onBlur);
  win.addEventListener('focus', onFocus);
  doc.addEventListener('visibilitychange', onVisibility);

  return {
    get paused() {
      return blurred || hidden;
    },
    destroy() {
      win.removeEventListener('blur', onBlur);
      win.removeEventListener('focus', onFocus);
      doc.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
