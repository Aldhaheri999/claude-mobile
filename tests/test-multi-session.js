// Multi-session isolation: each session gets its own headless term + serializer.
// Writing into session A must not leak into session B's snapshot.
const { makeTerm, write, stripAnsi, assert } = require('./helpers');

(async () => {
  console.log('test-multi-session');
  const a = makeTerm(80, 24);
  const b = makeTerm(80, 24);
  const c = makeTerm(80, 24);

  await write(a.term, 'aaaa session A content\r\n');
  await write(b.term, 'bbbb session B content\r\n');
  await write(c.term, 'cccc session C content\r\n');

  const ta = stripAnsi(a.ser.serialize());
  const tb = stripAnsi(b.ser.serialize());
  const tc = stripAnsi(c.ser.serialize());

  assert(ta.includes('aaaa') && !ta.includes('bbbb') && !ta.includes('cccc'),
    'session A snapshot is isolated', `got: ${JSON.stringify(ta)}`);
  assert(tb.includes('bbbb') && !tb.includes('aaaa') && !tb.includes('cccc'),
    'session B snapshot is isolated', `got: ${JSON.stringify(tb)}`);
  assert(tc.includes('cccc') && !tc.includes('aaaa') && !tc.includes('bbbb'),
    'session C snapshot is isolated', `got: ${JSON.stringify(tc)}`);

  a.term.dispose(); b.term.dispose(); c.term.dispose();
})();
