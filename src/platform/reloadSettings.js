// Asset changes restart at the title with the current settings. Keep unrelated
// URL diagnostics, explicit art/quality overrides and the hash intact.
export function reloadSettings(href, { mode, settings, muted } = {}) {
  const next = new URL(href);
  if (mode === 'solo') next.searchParams.delete('mode');
  else if (mode === 'shared' || mode === 'split') next.searchParams.set('mode', mode);
  for (const key of ['slip', 'lives', 'shadow']) {
    if (typeof settings?.[key] !== 'boolean') continue;
    if (key === 'shadow') {
      if (settings.shadow) next.searchParams.delete('shadow');
      else next.searchParams.set('shadow', 'off');
    } else if (settings[key]) next.searchParams.set(key, 'on');
    else next.searchParams.delete(key);
  }
  if (typeof muted === 'boolean') {
    if (muted) next.searchParams.set('mute', 'on');
    else next.searchParams.delete('mute');
  }
  return next;
}
