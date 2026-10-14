import { MAX_RESOLUTION } from '../config.js';

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

export function installResolutionControl(app, platform, choice, win = window, doc = document) {
  const label = doc.createElement('label');
  label.id = 'graphics-quality';
  label.style.cssText = 'position:fixed;left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));z-index:1;padding:6px 8px;border-radius:8px;background:#0b1a10;color:#f4e7c5;font:13px system-ui;display:flex;align-items:center;gap:8px';
  label.append(doc.createTextNode('Graphics'));
  const select = doc.createElement('select');
  select.id = 'graphics-quality-choice';
  select.style.cssText = 'font:inherit;color:inherit;background:#0b1a10;border:1px solid #f4e7c540;border-radius:4px;padding:4px';
  const choices = [['auto', 'Auto'], ['1.5', 'Balanced'], ['2', 'Sharp'], ['1', 'Performance']];
  if (!choices.some(([value]) => value === choice)) choices.push([choice, 'Custom']);
  for (const [value, title] of choices) {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = title;
    select.append(option);
  }
  select.value = choice;
  label.append(select);
  const hint = doc.createElement('span');
  hint.textContent = 'Reloads game';
  hint.style.cssText = 'font-size:11px;opacity:.7';
  label.append(hint);
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup', 'touchstart', 'touchend']) {
    label.addEventListener(type, (event) => event.stopPropagation());
  }
  select.addEventListener('change', () => {
    try { win.localStorage.setItem(RESOLUTION_STORAGE_KEY, select.value); } catch { /* URL still applies it. */ }
    const next = new URL(win.location.href);
    next.searchParams.set('resolution', select.value);
    win.location.assign(next.href);
  });
  // Changes reload assets at the chosen density; offer them between runs only.
  const visibility = () => {
    const hidden = platform.game.state === 'PLAYING';
    if (label.hidden !== hidden) {
      label.hidden = hidden;
      label.style.display = hidden ? 'none' : 'flex';
    }
  };
  visibility();
  app.events.on('poststep', visibility);
  doc.body.append(label);
  return label;
}
