// The HTML/CSS shell works before any game code downloads. Readiness means the
// main art, sound preparation, world setup and first game frame have all finished.
export function hideLoading(doc) {
  doc.defaultView?.__loadingErrorController?.abort();
  if (doc.defaultView) delete doc.defaultView.__loadingErrorController;
  const loading = doc.getElementById('loading');
  if (loading) loading.hidden = true;
}

export function createStartup(doc) {
  let state = 'loading';
  let resolve;
  const ready = new Promise((done) => { resolve = done; });
  const settle = (next) => {
    if (state !== 'loading') return;
    state = next;
    hideLoading(doc);
    if (next === 'ready') doc.documentElement.dataset.ready = 'true';
    resolve(next === 'ready');
  };
  return {
    ready,
    get complete() { return state === 'ready'; },
    get failed() { return state === 'failed'; },
    finish: () => settle('ready'),
    fail: () => settle('failed'),
  };
}
