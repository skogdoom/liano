import { execFile } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Resvg } from '@resvg/resvg-js';
import { expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const manifest = path => JSON.parse(readFileSync(join(repo, path), 'utf8'));
const svg = (box, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${color}"/></svg>`;

function centerPixel(file) {
  const png = readFileSync(file);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const image = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image width="${width}" height="${height}" href="data:image/png;base64,${png.toString('base64')}"/></svg>`).render();
  const offset = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
  return [...image.pixels.subarray(offset, offset + 4)];
}

it('builds cartoon tiles from custom SVG and PNG replacements at each tile density', async () => {
  const root = mkdtempSync(join(tmpdir(), 'liano-tile-build-'));
  try {
    mkdirSync(join(root, 'scripts'));
    symlinkSync(join(repo, 'src'), join(root, 'src'), 'junction');
    symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'junction');
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    copyFileSync(join(repo, 'scripts/build-art.mjs'), join(root, 'scripts/build-art.mjs'));

    // A small, valid pack exercises the production builder without rebuilding
    // all accepted artwork. Include the boot set and required cartoon additions.
    const keys = new Set(['backdrop.sky', 'backdrop.floor', 'backdrop.canopy', 'backdrop.nearTop', 'spider.body']);
    const classic = manifest('art/manifest.json').pieces.filter(p => keys.has(p.key));
    const cartoon = manifest('art/packs/cartoon/manifest.json').pieces.filter(p => keys.has(p.key) || ['spider.legs', 'ui.wordmark'].includes(p.key));
    for (const [dir, pieces, presentation] of [['art', classic], ['art/packs/cartoon', cartoon, { title: 'ui.wordmark' }]]) {
      const folder = join(root, dir);
      mkdirSync(join(folder, 'generated'), { recursive: true });
      writeFileSync(join(folder, 'manifest.json'), JSON.stringify({ pieces, presentation }));
      for (const piece of pieces) for (const frame of piece.frames) writeFileSync(join(folder, frame), svg(piece.box, '#112233'));
    }
    const custom = join(root, 'art/packs/cartoon/custom');
    mkdirSync(custom);
    const floor = cartoon.find(p => p.key === 'backdrop.floor');
    const canopy = cartoon.find(p => p.key === 'backdrop.canopy');
    writeFileSync(join(custom, 'backdrop.floor.svg'), svg(floor.box, '#ff00ff'));
    writeFileSync(join(custom, 'backdrop.canopy.png'), new Resvg(svg(canopy.box, '#00cc55'), { fitTo: { mode: 'width', value: canopy.box.w * 2 } }).render().asPng());
    writeFileSync(join(root, 'art/packs/cartoon/inventory.json'), '{"pieces":[]}');

    await run(process.execPath, [join(root, 'scripts/build-art.mjs')]);
    const output = join(root, 'public/art');
    expect(JSON.parse(readFileSync(join(output, 'cartoon/custom.json'), 'utf8'))).toEqual({
      'backdrop.floor': 'backdrop.floor.svg', 'backdrop.canopy': 'backdrop.canopy.png',
    });
    for (const density of [1, 2]) {
      expect(centerPixel(join(output, `cartoon/tiles/backdrop.floor@${density}x.png`))).toEqual([255, 0, 255, 255]);
      expect(centerPixel(join(output, `cartoon/tiles/backdrop.canopy@${density}x.png`))).toEqual([0, 204, 85, 255]);
      expect(centerPixel(join(output, `cartoon/tiles/backdrop.nearTop@${density}x.png`))).toEqual([17, 34, 51, 255]);
      expect(centerPixel(join(output, `classic/tiles/backdrop.floor@${density}x.png`))).toEqual([17, 34, 51, 255]);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
