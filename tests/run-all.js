// Runs every test in this directory, prints a summary, exits non-zero on any
// failure so CI / the scheduled-rebase agent can detect breakage.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const dir = __dirname;
const tests = fs.readdirSync(dir)
  .filter(f => f.startsWith('test-') && f.endsWith('.js'))
  .sort();

console.log('=========================================');
console.log(`Running ${tests.length} test file(s)`);
console.log('=========================================\n');

const results = [];
let totalPass = 0, totalFail = 0;

for (const t of tests) {
  const fullPath = path.join(dir, t);
  const r = cp.spawnSync(process.execPath, [fullPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const passCount = (r.stdout.match(/^  PASS/gm) || []).length;
  const failCount = (r.stdout.match(/^  FAIL/gm) || []).length;
  const ok = r.status === 0 && failCount === 0;

  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  console.log('');

  results.push({ test: t, ok, pass: passCount, fail: failCount });
  totalPass += passCount;
  totalFail += failCount;
}

console.log('=========================================');
console.log('Summary');
console.log('=========================================');
for (const r of results) {
  const status = r.ok ? 'OK ' : 'X  ';
  console.log(`  ${status}  ${r.test}  (${r.pass} pass, ${r.fail} fail)`);
}
console.log(`\nTotal assertions: ${totalPass} pass, ${totalFail} fail`);

const allOk = results.every(r => r.ok);
process.exit(allOk ? 0 : 1);
