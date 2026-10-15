// Phaser-only submenu state/input. The shared game's 1/2/3 mode picker remains
// unchanged: these keys select graphics only while this title submenu is open.
export const GRAPHICS_ITEMS = [
  { key: 'Digit1', choice: '1', text: '1 · Performance', y: -90 },
  { key: 'Digit2', choice: '1.5', text: '2 · Balanced', y: -15 },
  { key: 'Digit3', choice: '2', text: '3 · Sharp', y: 60 },
  { key: 'KeyA', choice: 'auto', text: 'A · Auto', y: 127 },
];
export const CONFIG_PANEL = { width: 440, height: 600, shiftY: 0 };
export const CONFIG_BACK_Y = 263;
export const ART_KEY = 'KeyX';

export class ConfigMenu {
  constructor(choice, { apply, remember = () => {}, clear = () => {}, art = 'classic', applyArt, rememberArt = () => {} } = {}) {
    this.choice = choice;
    this.apply = apply;
    this.remember = remember;
    this.clear = clear;
    this.open = false;
    this.applying = false;
    this.art = art;
    this.applyArt = applyArt;
    this.rememberArt = rememberArt;
  }

  sync(game) {
    if (game.state !== 'TITLE' && this.open) this.close();
  }

  show(game, accepts = true) {
    if (game.state !== 'TITLE' || !accepts || this.applying) return false;
    this.open = true;
    this.clear();
    return true;
  }

  close() {
    this.open = false;
    this.clear();
  }

  choose(choice) {
    if (!this.open || this.applying) return;
    if (choice === this.choice) { this.remember(choice); this.close(); return; }
    if (!GRAPHICS_ITEMS.some((item) => item.choice === choice)) return;
    this.applying = true;
    this.clear();
    this.apply(choice);
  }

  chooseArt(choice) {
    if (!this.open || this.applying || !['classic', 'cartoon'].includes(choice)) return;
    if (choice === this.art) { this.rememberArt(choice); this.close(); return; }
    if (!this.applyArt) return;
    this.applying = true;
    this.clear();
    this.applyArt(choice);
  }

  interceptKey(event, game, accepts) {
    this.sync(game);
    if (!this.open && !(event.code === 'KeyC' && game.state === 'TITLE')) return false;
    // Preserve browser shortcuts while keeping them out of the game's controls.
    if (event.ctrlKey || event.metaKey || event.altKey) return this.open;
    event.preventDefault();
    if (event.repeat || !accepts) return true;
    if (event.code === 'KeyC' || event.code === 'Escape') {
      if (this.open) this.close();
      else this.show(game, accepts);
    } else if (this.open) {
      if (event.code === ART_KEY) {
        this.chooseArt(this.art === 'classic' ? 'cartoon' : 'classic');
        return true;
      }
      const item = GRAPHICS_ITEMS.find((item) => item.key === event.code);
      if (item) this.choose(item.choice);
    }
    return true;
  }
}
