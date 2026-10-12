// M1 spike: builds the bench page (spike/bench.html) for production into dist-bench/,
// with the atlases, and serves it on the local network, for measuring on a phone:
// `npm run spike:bench`, then open the printed Network address + spike/bench.html.
// Needs `npm run art:build` first (the art in public/art/).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

const root = new URL('../../', import.meta.url);
// Paths, not URLs: a folder name with spaces must not turn into %20.
const outDir = fileURLToPath(new URL('dist-bench/', root));
if (!existsSync(new URL('public/art/pieces.json', root))) throw new Error('No art: run `npm run art:build` first');
await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true, rollupOptions: { input: fileURLToPath(new URL('spike/bench.html', root)) } } });
const server = await preview({ build: { outDir }, preview: { host: true, port: 4174 } });
server.printUrls();
console.log('Open <address>spike/bench.html (?engine=pixi|atlas|native, ?dpr=1|1.5|2).');
