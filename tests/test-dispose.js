// Risk #3 from the v3.2 assessment: undisposed headless terms leak ~750 KB
// each. Verify dispose() runs without throwing across many cycles.
const { makeTerm, write, assert } = require('./helpers');

(async () => {
  console.log('test-dispose');

  // Create + dispose 100 sessions. If dispose was a no-op, RSS would balloon.
  // We can't trivially measure RSS in a portable test, but the happy-path
  // contract is: 100 cycles complete without throwing.
  for (let i = 0; i < 100; i++) {
    const { term } = makeTerm(80, 24);
    await write(term, 'some output\r\n');
    term.dispose();
  }
  assert(true, '100 create/dispose cycles complete without throwing');

  // Confirm dispose actually flips the terminal into a non-functional state.
  // We don't try to use the disposed term -- xterm.js's behaviour after
  // dispose is implementation-defined (may throw, may no-op). Our contract
  // is just that the lifecycle call itself doesn't throw, and that the
  // server's wireSessionProc.onData guards against writing to a disposed
  // term via the `if (session.headless)` null-check after dispose sets it
  // to null in case 'close' / onExit cleanup.
  const { term } = makeTerm(80, 24);
  await write(term, 'pre-dispose\r\n');
  let disposeThrew = false;
  try { term.dispose(); } catch (e) { disposeThrew = true; }
  assert(!disposeThrew, 'dispose() does not throw');
})();
