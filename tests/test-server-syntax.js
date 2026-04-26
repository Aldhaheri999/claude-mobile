// Cheap but high-value: confirm server.js parses without syntax errors.
// Catches stupid mistakes (missing brace, typo, broken require) before deploy.
// We can't actually start the server (it needs config.json, dtach, etc.), but
// requiring the file proves the JS parses + module loads + top-level requires
// resolve.
const path = require('path');
const cp = require('child_process');
const { assert } = require('./helpers');

console.log('test-server-syntax');
const serverPath = path.join(__dirname, '..', 'server.js');

// Use `node --check` -- syntax-check only, no execution. Avoids tripping over
// missing config.json / dtach / WSL / OS-specific entry points.
const result = cp.spawnSync(process.execPath, ['--check', serverPath], {
  encoding: 'utf8', shell: false,
});

if (result.status === 0) {
  assert(true, 'server.js passes node --check');
} else {
  console.error('  STDERR:', result.stderr);
  assert(false, 'server.js syntax check failed', `exit=${result.status}`);
}

// Also verify the new headless deps actually require cleanly.
try {
  const { Terminal } = require('@xterm/headless');
  const { SerializeAddon } = require('@xterm/addon-serialize');
  assert(typeof Terminal === 'function', '@xterm/headless exports Terminal');
  assert(typeof SerializeAddon === 'function', '@xterm/addon-serialize exports SerializeAddon');
} catch (e) {
  assert(false, 'headless deps require cleanly', e.message);
}
