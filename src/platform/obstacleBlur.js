import { OBJECT_EXPOSURE_CSS } from '../render/world/objectExposure.js';

// Explicit experiment, separate from the older optional backdrop exposure. B and
// the button allow a comparison in the same swing, without reloading/random seeds.
export function installObstacleBlur(platform, win = window, doc = document) {
  if (new URLSearchParams(win.location.search).get('obstacleblur') !== 'on') return;
  const config = { enabled: true, limitCSS: OBJECT_EXPOSURE_CSS };
  platform.obstacleBlur = config;
  const button = doc.createElement('button');
  button.type = 'button';
  button.id = 'obstacle-blur-toggle';
  button.style.cssText = 'position:fixed;right:8px;bottom:52px;z-index:11;padding:6px 10px;font:12px system-ui;cursor:pointer';
  const label = () => { button.textContent = `Obstacle blur: ${config.enabled ? 'ON' : 'OFF'} (B)`; };
  const toggle = () => {
    config.enabled = !config.enabled;
    for (const pane of platform.world?.panes ?? []) pane.obstacleExposure?.reset();
    label();
  };
  button.addEventListener('pointerdown', (event) => event.stopPropagation());
  button.addEventListener('click', (event) => { event.stopPropagation(); toggle(); button.blur(); });
  win.addEventListener('keydown', (event) => {
    if (event.code === 'KeyB' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) toggle();
  });
  label();
  doc.body.append(button);
}
