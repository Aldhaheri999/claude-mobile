// Risk #1 from the v3.2 assessment: if headless dims drift from PTY dims,
// snapshots will have wrong cols and lines wrap weirdly on the client. Verify
// resize() updates dims and preserves content.
const { makeTerm, write, stripAnsi, assert } = require('./helpers');

(async () => {
  console.log('test-resize');
  const { term, ser } = makeTerm(80, 24);

  await write(term, 'before resize line\r\n');
  assert(term.cols === 80, 'initial cols');
  assert(term.rows === 24, 'initial rows');

  // Simulate phone rotating to landscape (taller, narrower)
  term.resize(46, 40);
  assert(term.cols === 46, 'cols after resize');
  assert(term.rows === 40, 'rows after resize');

  await write(term, 'after resize line\r\n');
  const text = stripAnsi(ser.serialize());
  assert(text.includes('before resize line'),
    'pre-resize content preserved in scrollback');
  assert(text.includes('after resize line'),
    'post-resize content rendered');

  // Resize back -- dims must update again
  term.resize(120, 30);
  assert(term.cols === 120 && term.rows === 30, 'resize is idempotent');
})();
