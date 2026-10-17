import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every relative link in the repository's Markdown (the plans, guides and reviews) points at a
// file that exists, and every #anchor at a heading in it (PLAN.md, "Keeping the plan").
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', 'dist-bench', 'test-results', 'playwright-report', '.git']);

function markdownFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

// Text without code blocks and inline code, whose brackets are not links.
const withoutBlocks = (text) => text.replace(/^```[\s\S]*?^```/gm, '');
const prose = (text) => withoutBlocks(text).replace(/`[^`\n]*`/g, '');

// A heading's anchor as GitHub makes it: lower case, punctuation dropped, spaces as hyphens,
// repeats numbered.
function anchors(text) {
  const seen = new Map();
  const result = new Set();
  for (const [, heading] of withoutBlocks(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = heading
      .replace(/`/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    result.add(n ? `${base}-${n}` : base);
  }
  return result;
}

const links = (text) => [...prose(text).matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]);

describe('Markdown links', () => {
  const files = markdownFiles(root);
  const anchorCache = new Map();
  const anchorsOf = (path) => {
    if (!anchorCache.has(path)) anchorCache.set(path, anchors(readFileSync(path, 'utf8')));
    return anchorCache.get(path);
  };

  it('finds the plans', () => {
    const names = files.map((f) => relative(root, f));
    for (const plan of ['PLAN.md', 'docs/plans/gameplay.md', 'docs/plans/history/phaser-migration.md']) {
      expect(names).toContain(plan);
    }
  });

  it('point at files and headings that exist', () => {
    const broken = [];
    for (const file of files) {
      for (const link of links(readFileSync(file, 'utf8'))) {
        if (/^[a-z][a-z+.-]*:/i.test(link)) continue; // http:, mailto: and the like
        const [path, anchor] = link.split('#');
        const target = path ? resolve(dirname(file), decodeURI(path)) : file;
        const where = `${relative(root, file)}: ${link}`;
        if (!existsSync(target)) broken.push(`${where} (no such file)`);
        else if (anchor && target.endsWith('.md') && !anchorsOf(target).has(decodeURIComponent(anchor))) {
          broken.push(`${where} (no such heading)`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('makes anchors as GitHub does', () => {
    const made = anchors('# Tunables (`src/config.js`)\n## M7. Parity, performance and polish (M–L)\n## A\n## A\n```\n# not a heading\n```');
    expect([...made]).toEqual(['tunables-srcconfigjs', 'm7-parity-performance-and-polish-ml', 'a', 'a-1']);
  });
});
