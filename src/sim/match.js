import { LIVES_2P } from '../config.js';

// Mode rules. `keys` lists the input role that controls each player, in player order
// (see KEYS in config.js). Shared screen arrives in milestone 21.
export const MODES = Object.freeze({
  solo: { id: 'solo', label: '1P', players: 1, lives: 1, keys: ['primary'], enabled: true },
  shared: { id: 'shared', label: '2P shared', players: 2, lives: LIVES_2P, keys: ['p1', 'p2'], enabled: false },
  split: { id: 'split', label: '2P split', players: 2, lives: LIVES_2P, keys: ['p1', 'p2'], enabled: true },
});

// The order of the title screen's mode picker: keys 1, 2 and 3.
export const MODE_ORDER = Object.freeze(['solo', 'shared', 'split']);

// The player an input role controls in `mode`, or -1 if none.
export function playerFor(mode, role) {
  return MODES[mode].keys.indexOf(role);
}
