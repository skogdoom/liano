// The shadow monkey: plain drawing and placement data. Colours, sizes, the drawing
// functions (the art pieces are generated from them),
// and where things go and how they move.

// The shadow monkey (see Game.shadowFrame): a grey, see-through monkey on lianas of its
// own, grey and see-through too, as it swung on them in the best earlier game. A liana fades
// in before the shadow grabs it and out after it lets go (see ShadowReplay).
export const SHADOW_FUR = { fur: 0xb8bfc4, furDark: 0x8b949a, skin: 0xd5dadd };
export const SHADOW_LIANA = { ropeDark: 0x4d565b, rope: 0x929ca1, leaf: 0x7c868c, leafDark: 0x626c72 };
export const SHADOW_ALPHA = 0.36;
