import { definePieces } from '../piece.js';
import { BACKDROP_PIECES } from './backdrop.js';
import { BRANCH_PIECES, PANTHER_PIECES } from './branch.js';
import { DECORATION_PIECES } from './decorations.js';
import { ITEM_PIECES } from './items.js';
import { LIANA_PIECES } from './liana.js';
import { MONKEY_PIECES } from './monkey.js';
import { MOVING_PIECES } from './moving.js';
import { BEEHIVE_PIECES, ROCK_PIECES, SUPPORT_PIECES, THORN_BUSH_PIECES } from './obstacles.js';
import { TEMPLE_PIECES } from './temple.js';
import { UI_PIECES } from './ui.js';

// Every piece of art in the game (PHASER_PLAN.md, section 5 and the M4 inventory).
export const PIECES = definePieces([
  ...BACKDROP_PIECES,
  ...MONKEY_PIECES,
  ...LIANA_PIECES,
  ...ITEM_PIECES,
  ...UI_PIECES,
  ...SUPPORT_PIECES,
  ...BRANCH_PIECES,
  ...PANTHER_PIECES,
  ...DECORATION_PIECES,
  ...THORN_BUSH_PIECES,
  ...ROCK_PIECES,
  ...BEEHIVE_PIECES,
  ...TEMPLE_PIECES,
  ...MOVING_PIECES,
]);
