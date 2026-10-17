import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cartoonInventory, inventorySummary } from '../src/art/cartoonInventory.js';

const root = new URL('../art/', import.meta.url);
const folder = new URL('packs/cartoon/', root);
const file = new URL('inventory.json', folder);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const inventory = cartoonInventory(manifest, previous);
const json = `${JSON.stringify(inventory, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (!existsSync(file) || readFileSync(file, 'utf8') !== json) {
    throw new Error('Cartoon inventory is out of date. Run npm run art:cartoon:inventory.');
  }
} else {
  mkdirSync(folder, { recursive: true });
  writeFileSync(file, json);
}
const summary = inventorySummary(inventory);
console.log(`Cartoon inventory: ${inventory.pieceCount} pieces, ${inventory.frameCount} frames; ` +
  Object.entries(summary.totals).map(([status, count]) => `${count} ${status}`).join(', '));
