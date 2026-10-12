import { FULLSCREEN_STROKES, drawCorners } from '../../render/fullscreenButton.js';
import { drawSpeaker, drawSpeakerCross, drawSpeakerWaves } from '../../render/muteButton.js';
import { PANEL_RADIUS, drawArrow, drawPanel } from '../../render/overlays.js';
import { MAX_UI_SCALE } from '../../config.js';

// The HUD and the overlays: the panels behind the title, results and pause texts (a
// 9-slice: the corners stay as they are and the edges stretch), the arrow at the top edge
// while a monkey is above the view, and the mute and full-screen buttons. The texts stay
// Phaser Text.
export const PANEL_REFERENCE = 64;
// The corners: the radius and the edge's stroke (1 px outside the rectangle).
const SLICE = PANEL_RADIUS + 2;
const fullscreenIcon = (inward) => (g) => {
  for (const style of FULLSCREEN_STROKES) drawCorners(g, inward, style);
  return g;
};

// Enlarged with the layout's `ui` scale (portrait phones).
const ui = { set: 'boot', scale: MAX_UI_SCALE };

export const UI_PIECES = [
  {
    ...ui,
    key: 'ui.panel',
    kind: 'slice',
    purpose: `A panel: a see-through dark rounded rectangle (radius ${PANEL_RADIUS}) with a faint edge, from its top left (the origin), ${PANEL_REFERENCE} px square; 9-sliced to each panel's size.`,
    box: { x: -1, y: -1, w: PANEL_REFERENCE + 2, h: PANEL_REFERENCE + 2 },
    slices: { left: SLICE, right: SLICE, top: SLICE, bottom: SLICE },
    frames: [(g) => drawPanel(g, 0, 0, PANEL_REFERENCE, PANEL_REFERENCE)],
  },
  {
    ...ui,
    key: 'ui.arrow',
    purpose: "The arrow at the top edge pointing up at a monkey above the view; its tip at the origin.",
    frames: [(g) => drawArrow(g)],
  },
  {
    ...ui,
    key: 'ui.speaker',
    purpose: 'The mute button: a speaker, from its top left (the origin).',
    frames: [(g) => drawSpeaker(g)],
  },
  {
    ...ui,
    key: 'ui.speakerWaves',
    purpose: "The speaker's sound waves, while the sound is on (in the speaker's coordinates).",
    frames: [(g) => drawSpeakerWaves(g)],
  },
  {
    ...ui,
    key: 'ui.speakerCross',
    purpose: 'The cross by the speaker, while muted (in its coordinates).',
    frames: [(g) => drawSpeakerCross(g)],
  },
  {
    ...ui,
    key: 'ui.fullscreen',
    purpose: 'The full-screen button, from its top left (the origin): corner brackets pointing out to enter full screen (frame 0), pulled in to leave it (frame 1).',
    frames: [fullscreenIcon(false), fullscreenIcon(true)],
  },
];
