import { definePieces } from '../piece.js';
import { BACKDROP_PIECES } from './backdrop.js';
import { BRANCH_PIECES, PANTHER_PIECES } from './branch.js';
import { LIANA_PIECES } from './liana.js';

// Every piece of art in the game (PHASER_PLAN.md, section 5 and the M4 inventory).
export const PIECES = definePieces([...BACKDROP_PIECES, ...LIANA_PIECES, ...BRANCH_PIECES, ...PANTHER_PIECES]);
