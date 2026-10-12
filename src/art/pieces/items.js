import { HEART_GLINT, bananaShape, drawBanana, drawGlint } from '../../views/banana.js';
import { drawHeart } from '../../views/hearts.js';

// What the monkeys collect, and the hearts and banana icons of the HUD and results.
const { glint } = bananaShape();

export const GLINT_SIZE = 8;
export const FIELD_HEART = 17;
export const HUD_HEART = 11;
export const HUD_BANANA = 11;
export const RESULTS_BANANA = 13;

export const ITEM_PIECES = [
  {
    key: 'banana.body',
    set: 'boot',
    purpose: 'A banana to take, about its centre (the origin): curved, with a ridge, a stem and a dark tip. It bobs and rocks.',
    attach: { glint: [glint.x, glint.y] },
    frames: [(g) => drawBanana(g)],
  },
  {
    key: 'banana.glint',
    set: 'boot',
    purpose: 'A four-pointed glint on a banana (or a heart), about its centre; it fades in and out.',
    frames: [(g) => drawGlint(g, GLINT_SIZE)],
  },
  {
    key: 'heart.field',
    set: 'boot',
    purpose: `A heart to take (a banana turned into a life), ${FIELD_HEART} px across about its centre.`,
    attach: { glint: [HEART_GLINT.x, HEART_GLINT.y] },
    frames: [(g) => drawHeart(g, FIELD_HEART)],
  },
  {
    key: 'heart.hud',
    set: 'boot',
    purpose: `A heart in the HUD, ${HUD_HEART} px across about its centre: a life left (frame 0), a life lost (frame 1, an outline).`,
    frames: [(g) => drawHeart(g, HUD_HEART, true), (g) => drawHeart(g, HUD_HEART, false)],
  },
  {
    key: 'banana.hud',
    set: 'boot',
    purpose: `The banana by each player's banana count in the HUD (${HUD_BANANA} px), about its centre.`,
    frames: [(g) => drawBanana(g, HUD_BANANA)],
  },
  {
    key: 'banana.results',
    set: 'boot',
    purpose: `The banana by the bananas taken on the results (${RESULTS_BANANA} px), about its centre.`,
    frames: [(g) => drawBanana(g, RESULTS_BANANA)],
  },
];
