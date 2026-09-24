// When something breaks, show a message with a reload button instead of leaving a
// frozen canvas. Also a smaller notice for passing states (restoring graphics).

// Errors from our own scripts only: extensions and cross-origin scripts ("Script
// error." with no file) must not take the game down.
export function isOwnError(event, origin) {
  return typeof event.filename === 'string' && event.filename.startsWith(origin);
}

export function createFatalOverlay(doc, { reload = () => location.reload() } = {}) {
  const el = doc.getElementById('fatal');
  el.querySelector('button').addEventListener('click', reload);
  let shown = false;
  return {
    get shown() {
      return shown;
    },
    show(error) {
      if (shown) return;
      shown = true;
      console.error(error);
      el.classList.add('shown');
    },
  };
}

export function createNotice(doc) {
  const el = doc.getElementById('notice');
  return {
    show(text) {
      el.textContent = text;
      el.classList.add('shown');
    },
    hide() {
      el.classList.remove('shown');
    },
  };
}
