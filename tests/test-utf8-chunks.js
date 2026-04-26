// node-pty can split UTF-8 multi-byte chars across chunks. xterm.js handles
// this internally (buffers incomplete bytes for the next write). Verify the
// emoji and box-drawing chars in Claude Code's robot avatar survive a split.
const { makeTerm, write, stripAnsi, assert } = require('./helpers');

(async () => {
  console.log('test-utf8-chunks');
  const { term, ser } = makeTerm(80, 24);

  // The Claude Code robot avatar uses block-element chars (3-byte UTF-8 each).
  // ▐ = E2 96 90, ▛ = E2 96 9B, █ = E2 96 88, ▜ = E2 96 9C, ▌ = E2 96 8C
  const robotBytes = Buffer.from([
    0xE2, 0x96, 0x90, 0xE2, 0x96, 0x9B, 0xE2, 0x96, 0x88,
    0xE2, 0x96, 0x88, 0xE2, 0x96, 0x88, 0xE2, 0x96, 0x9C, 0xE2, 0x96, 0x8C,
  ]);

  // Split mid-codepoint: 5 bytes (last byte is a partial codepoint start)
  await write(term, robotBytes.slice(0, 5));
  await write(term, robotBytes.slice(5));

  const text = stripAnsi(ser.serialize());
  assert(text.includes('▐▛███▜▌'),
    'split UTF-8 multi-byte sequence reassembled correctly',
    `got: ${JSON.stringify(text)}`);
})();
