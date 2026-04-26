// Reproduces the v3.2 root-cause symptom in isolation: writing the Claude Code
// welcome banner 3x into a headless terminal must collapse to ONE banner in
// the serialized snapshot. This is the specific bug v3.2 was built to fix.
const { makeTerm, write, stripAnsi, syntheticBanner, assert } = require('./helpers');

(async () => {
  console.log('test-banner-dedup');
  const { term, ser } = makeTerm(46, 40);
  const banner = syntheticBanner();

  for (let i = 0; i < 3; i++) await write(term, banner);

  const snapshot = ser.serialize({ scrollback: 1000 });
  const text = stripAnsi(snapshot);
  const matches = (text.match(/Claude Code v2\.1\.119/g) || []).length;

  assert(matches === 1, '3 banner writes collapse to 1 banner in snapshot',
    `expected 1 banner, found ${matches}`);
  assert(snapshot.length < banner.length * 3,
    'snapshot is smaller than 3x raw banners',
    `snapshot=${snapshot.length}, raw=${banner.length * 3}`);
  assert(text.includes('Opus 4.7 (1M context)'),
    'snapshot preserves real banner content');
})();
