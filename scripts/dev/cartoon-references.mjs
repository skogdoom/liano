// Explicit capture tool, never called by tests. Inspect intended visual changes
// before replacing a baseline; record its approved artwork commit in the manifest.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../browser-tests/references/cartoon/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
if (!process.argv.includes('--write')) throw new Error('Use --write to capture the approved references explicitly.');
if (!process.argv.includes('--replace') && manifest.references.some(r => existsSync(new URL(`${r.id}.png`, root)))) {
  throw new Error('References exist. Inspect the intended change and use --write --replace to replace them.');
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5174/cartoon-reference.html?capture=1');
  await page.waitForFunction(() => document.documentElement.dataset.references, null, { timeout: 150_000 });
  if (await page.locator('html').getAttribute('data-references') !== 'captured') throw new Error('Capture failed: ' + await page.locator('#references').textContent());
  const captures = await page.locator('canvas[data-current]').evaluateAll(canvases => canvases.map(canvas => ({
    id: canvas.dataset.current, width: canvas.width, height: canvas.height, png: canvas.toDataURL().split(',')[1],
  })));
  if (errors.length) throw new Error(errors.join('\n'));
  if (JSON.stringify(captures.map(c => c.id)) !== JSON.stringify(manifest.references.map(r => r.id))) throw new Error('Incomplete capture set');
  for (const reference of manifest.references) {
    const capture = captures.find(c => c.id === reference.id);
    if (capture.width !== reference.width || capture.height !== reference.height) throw new Error(`Changed size: ${reference.id}`);
    const bytes = Buffer.from(capture.png, 'base64');
    reference.sha256 = createHash('sha256').update(bytes).digest('hex');
    writeFileSync(new URL(`${reference.id}.png`, root), bytes);
  }
  writeFileSync(new URL('manifest.json', root), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Captured ${captures.length} cartoon references from approved artwork ${manifest.sourceCommit}.`);
} finally { await browser.close(); }
