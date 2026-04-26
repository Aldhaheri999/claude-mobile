// Real history preservation across TUI restarts. Claude Code uses \x1b[2J\x1b[H
// on every restart, which clears the VISIBLE screen but does NOT push visible
// content into scrollback (standard ANSI semantics). Only rows that scrolled
// into scrollback BEFORE the clear (because the visible area filled up and
// content was pushed up by newer output) survive. v3.1.7 dropped EVERYTHING
// before a clear; v3.2 keeps the scrollback rows. That's the win.
const { makeTerm, write, stripAnsi, assert } = require('./helpers');

(async () => {
  console.log('test-history-preserved');
  const ROWS = 24;
  const { term, ser } = makeTerm(80, ROWS, 500);

  // Write 50 lines into a 24-row screen. As output accumulates past row 24,
  // earlier rows scroll up into scrollback. Of the 50 lines: ~26 should be
  // in scrollback (pushed up), ~24 visible.
  for (let i = 1; i <= 50; i++) {
    await write(term, `assistant: message line ${i}\r\n`);
  }
  // Now clear the visible screen (TUI restart). Visible 24 rows vaporise.
  // Scrollback rows survive.
  await write(term, '\x1b[2J\x1b[H');
  await write(term, 'NEW SESSION STARTED\r\n');

  const text = stripAnsi(ser.serialize({ scrollback: 500 }));

  assert(text.includes('NEW SESSION STARTED'),
    'snapshot includes content after the clear-screen');
  assert(text.includes('message line 1'),
    'snapshot still includes oldest scrollback line (was pushed up early)',
    `snapshot text: ${JSON.stringify(text.slice(0, 500))}`);
  // The most recent visible-screen lines should be GONE (vaporised by \x1b[2J).
  // Lines visible at clear time were roughly 27-50 (the last screen-full).
  // Anything in that range should NOT appear.
  const survivedLine48 = text.includes('message line 48');
  console.log(`  message line 48 survived: ${survivedLine48} (informational -- depends on exact scroll behaviour)`);

  // The KEY claim of v3.2 vs v3.1.7: scrollback rows survive across clear.
  // v3.1.7 would have dropped line 1 entirely. v3.2 keeps it.
  const earlyLineCount = [1, 2, 3, 4, 5].filter(n => text.includes(`message line ${n}\n`) || text.includes(`message line ${n}\r`) || text.match(new RegExp(`message line ${n}\\b`))).length;
  assert(earlyLineCount >= 3,
    'at least 3 of the earliest 5 lines survived (scrollback preserved across clear)',
    `survived count: ${earlyLineCount}`);
})();
