// M1 spike: builds the bench page (spike/bench.html) for production into dist-bench/,
// with the atlases, and serves it on the local network, for measuring on a phone:
// `npm run spike:bench`, then open the printed Network address + spike/bench.html.
// Needs `npm run art:atlas` first.
import { cpSync, existsSync } from 'node:fs';
import { build, preview } from 'vite';

const root = new URL('../../', import.meta.url);
const outDir = new URL('dist-bench/', root).pathname;
if (!existsSync(new URL('art/build/pieces.json', root))) throw new Error('No atlases: run `npm run art:atlas` first');
await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true, rollupOptions: { input: new URL('spike/bench.html', root).pathname } } });
cpSync(new URL('art/build/', root), `${outDir}art/build/`, { recursive: true, filter: (path) => !path.includes('/resvg') });
const server = await preview({ build: { outDir }, preview: { host: true, port: 4174 } });
server.printUrls();
console.log('Open <address>spike/bench.html (?engine=pixi|atlas|native, ?dpr=1|1.5|2).');
