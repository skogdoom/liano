// `node --import ./scripts/dev/json.mjs script.mjs`: see json-hooks.mjs.
import { register } from 'node:module';

register('./json-hooks.mjs', import.meta.url);
