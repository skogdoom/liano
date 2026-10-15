import { reloadSettings } from './reloadSettings.js';

export const ART_STORAGE_KEY = 'liano.art';
export const ART_PACKS = ['classic', 'cartoon'];
export const DEFAULT_ART_PACK = 'cartoon';
export const validArtChoice = (choice) => ART_PACKS.includes(choice);

export function artChoice(search, win = {}) {
  const query = new URLSearchParams(search);
  if (query.has('art')) return validArtChoice(query.get('art')) ? query.get('art') : DEFAULT_ART_PACK;
  try {
    const saved = win.localStorage?.getItem(ART_STORAGE_KEY);
    return validArtChoice(saved) ? saved : DEFAULT_ART_PACK;
  } catch { return DEFAULT_ART_PACK; }
}

export function rememberArtChoice(choice, win = window) {
  if (!validArtChoice(choice)) return;
  try { win.localStorage.setItem(ART_STORAGE_KEY, choice); } catch { /* The URL remains usable. */ }
}

export function applyArtChoice(choice, win = window, state = {}) {
  if (!validArtChoice(choice)) return;
  rememberArtChoice(choice, win);
  const next = reloadSettings(win.location.href, state);
  next.searchParams.set('art', choice);
  win.location.assign(next.href);
}
