// Shared test helpers. Keep dependencies minimal -- these tests must be
// runnable in any clean clone via `npm install && npm test`, including the
// scheduled-rebase agent's CI-like environment.
const { Terminal: HeadlessTerminal } = require('@xterm/headless');
const { SerializeAddon } = require('@xterm/addon-serialize');

function makeTerm(cols = 46, rows = 40, scrollback = 1000) {
  const term = new HeadlessTerminal({ cols, rows, scrollback, allowProposedApi: true });
  const ser = new SerializeAddon();
  term.loadAddon(ser);
  return { term, ser };
}

// Promisified write -- xterm.js's write() is async (queued through its parser),
// so without awaiting the callback, serialize() may run before bytes are consumed.
function write(term, data) {
  return new Promise(res => term.write(data, res));
}

// Strip ANSI escapes for human-readable assertion of snapshot content.
function stripAnsi(s) {
  return s
    .replace(/\x1b\[[\d;?]*[@-~]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b./g, '');
}

// A synthetic "banner" payload modelled on what Claude Code v2.x emits:
// terminal mode setup, clear-screen, attribute reset, cursor home, then
// content positioned absolutely. The KEY ingredient is \x1b[2J (clear
// screen) -- without it, headless can't dedupe and the bug returns.
function syntheticBanner(label = 'Claude Code v2.1.119') {
  return (
    '\x1b[?25l' +              // hide cursor
    '\x1b[2J' +                // clear entire screen <-- this is what makes dedup work
    '\x1b[m' +                 // reset attributes
    '\x1b[H' +                 // cursor home
    '\x1b[1m' + label + '\x1b[m\r\n' +
    'Opus 4.7 (1M context)\r\n' +
    'Claude Max\r\n' +
    'C:\\Dev\\test-project\r\n'
  );
}

// Assertion helper -- prints PASS/FAIL with context, exits non-zero on fail.
function assert(cond, msg, detail) {
  if (cond) {
    console.log(`  PASS  ${msg}`);
  } else {
    console.error(`  FAIL  ${msg}`);
    if (detail !== undefined) console.error(`        ${detail}`);
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${msg}`);
  }
}

module.exports = { makeTerm, write, stripAnsi, syntheticBanner, assert };
