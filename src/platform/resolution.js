import { MAX_RESOLUTION } from '../config.js';
import { reloadSettings } from './reloadSettings.js';

export const RESOLUTION_STORAGE_KEY = 'liano.phaser.resolution';

function validChoice(value) {
  if (value === 'auto') return value;
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 && number <= MAX_RESOLUTION
    ? String(number) : null;
}

// Explicit test URLs override saved choices without changing them. Storage can
// be unavailable in private/embedded browsing; the URL and Auto still work.
export function resolutionChoice(search, win = {}) {
  const query = new URLSearchParams(search);
  if (query.has('resolution')) return validChoice(query.get('resolution')) ?? 'auto';
  try {
    return validChoice(win.localStorage?.getItem(RESOLUTION_STORAGE_KEY)) ?? 'auto';
  } catch {
    return 'auto';
  }
}

export function resolutionLimit(search, { userAgent = '', preference = 'auto' } = {}) {
  const query = new URLSearchParams(search);
  const choice = validChoice(query.has('resolution') ? query.get('resolution') : preference) ?? 'auto';
  if (choice !== 'auto') return Number(choice);
  // Actual Safari results favor 1.5 over 2. This is a conservative browser
  // default, not an inferred GPU performance score. main.js also caps by DPR.
  const safari = /AppleWebKit\//.test(userAgent) && /Version\/.*Safari\//.test(userAgent) &&
    !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(userAgent);
  return safari ? 1.5 : MAX_RESOLUTION;
}

export function rememberResolutionChoice(choice, win = window) {
  if (!validChoice(choice)) return;
  try { win.localStorage.setItem(RESOLUTION_STORAGE_KEY, choice); } catch { /* URL still applies it. */ }
}

export function applyResolutionChoice(choice, win = window, state = {}) {
  if (!validChoice(choice)) return;
  rememberResolutionChoice(choice, win);
  const next = reloadSettings(win.location.href, state);
  next.searchParams.set('resolution', choice);
  win.location.assign(next.href);
}
