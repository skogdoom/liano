// Summarizes the test reports CI keeps (M9b.1): the slowest unit files and tests from
// reports/unit.json (Vitest), and the slowest, retried and failed browser checks from
// reports/browser.json (Playwright). `node scripts/report-timings.mjs unit|browser`
// prints Markdown; on GitHub it also goes to the job's summary, and a short version
// becomes a notice on the run, where it can be read without downloading the reports.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const kind = process.argv[2];
const file = `reports/${kind}.json`;
if (!existsSync(file)) {
  console.log(`No ${file}.`);
  process.exit(0);
}
const report = JSON.parse(readFileSync(file, 'utf8'));
const s = (ms) => `${(ms / 1000).toFixed(1)} s`;
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`,
  ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');

let markdown;
let notice;
if (kind === 'unit') {
  const files = report.testResults.map((f) => ({ name: f.name.replace(/.*\/tests\//, 'tests/'), ms: f.endTime - f.startTime }));
  const tests = report.testResults.flatMap((f) => f.assertionResults.map((t) => ({ name: t.fullName, ms: t.duration ?? 0 })));
  files.sort((a, b) => b.ms - a.ms);
  tests.sort((a, b) => b.ms - a.ms);
  const wall = Math.max(...report.testResults.map((f) => f.endTime)) - report.startTime;
  markdown = [`### Unit tests: ${report.numPassedTests} passed, ${report.numFailedTests} failed, ${s(wall)}`,
    table(['Slowest files', 'Time'], files.slice(0, 8).map((f) => [f.name, s(f.ms)])),
    table(['Slowest tests', 'Time'], tests.slice(0, 10).map((t) => [t.name, s(t.ms)]))].join('\n\n');
  notice = `${report.numPassedTests} passed, ${report.numFailedTests} failed in ${s(wall)}; slowest files: `
    + files.slice(0, 5).map((f) => `${f.name} ${s(f.ms)}`).join(', ');
} else {
  const checks = [];
  const walk = (suite, path) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        checks.push({ name: `${spec.file}: ${[...path, spec.title].join(' › ')}`, status: test.status, results: test.results });
      }
    }
    for (const inner of suite.suites ?? []) walk(inner, inner.title && !inner.title.endsWith('.js') ? [...path, inner.title] : path);
  };
  for (const suite of report.suites) walk(suite, []);
  const time = (c) => c.results.reduce((sum, r) => sum + r.duration, 0);
  const firstLine = (r) => (r.error?.message ?? r.errors?.[0]?.message ?? '').split('\n')[0].replace(/\|/g, '/').slice(0, 160);
  const retried = checks.filter((c) => c.results.length > 1);
  const failed = checks.filter((c) => c.status === 'unexpected');
  const lost = retried.reduce((sum, c) => sum + c.results.slice(0, -1).reduce((t, r) => t + r.duration, 0), 0);
  const slowest = [...checks].sort((a, b) => time(b) - time(a));
  const { stats } = report;
  markdown = [`### Browser checks: ${stats.expected} passed, ${stats.flaky} flaky, ${stats.unexpected} failed, ${s(stats.duration)}`,
    `Failed attempts before a retry: ${s(lost)}.`,
    table(['Slowest checks', 'Time', 'Attempts'], slowest.slice(0, 12).map((c) => [c.name, s(time(c)), c.results.length])),
    retried.length ? table(['Retried or failed', 'Attempts', 'First error'], retried.map((c) =>
      [c.name, c.results.map((r) => `${r.status} ${s(r.duration)} (worker ${r.workerIndex})`).join(', '), firstLine(c.results[0])])) : 'No retries.',
  ].join('\n\n');
  notice = `${stats.expected} passed, ${stats.flaky} flaky, ${stats.unexpected} failed in ${s(stats.duration)}; `
    + `${s(lost)} in failed attempts; slowest: ${slowest.slice(0, 5).map((c) => `${c.name} ${s(time(c))}`).join(', ')}`
    + (retried.length ? `; retried: ${retried.map((c) => `${c.name} (${firstLine(c.results[0])})`).join('; ')}` : '')
    + (failed.length ? `; failed: ${failed.map((c) => c.name).join('; ')}` : '');
}

console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=${kind} test timings::${notice.replace(/%/g, '%25').replace(/\r?\n/g, '%0A')}`);
