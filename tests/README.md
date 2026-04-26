# tests/

Verification suite for v3.2's `@xterm/headless` + `@xterm/addon-serialize`
migration. Every test is portable -- runnable on a clean clone with just
`npm install && npm test`. No reliance on Windows / WSL / dtach / a real
PTY / a running server.

## Run

```bash
npm install
npm test
```

Exits 0 if all assertions pass, non-zero on any failure. The scheduled
fork-rebase agent (`https://claude.ai/code/routines/trig_018kG9nDcjx5pmw7nGyXUXBN`)
runs `npm test` after rebasing, so any upstream change that breaks the
v3.2 invariants gets surfaced.

## What each test proves

| File | Invariant under test | Why it matters |
|---|---|---|
| `test-banner-dedup.js` | 3x banner writes collapse to 1 banner in snapshot | The exact symptom v3.2 was built to fix. If this fails, banners are stacking again. |
| `test-history-preserved.js` | Pre-clear-screen scrollback survives in snapshot | v3.2's promise vs. v3.1.7. If this fails, real conversation history is being dropped at clears. |
| `test-utf8-chunks.js` | Split UTF-8 multi-byte sequences reassemble correctly | The robot avatar uses block-element chars (3 bytes each). node-pty can split mid-codepoint. |
| `test-resize.js` | `resize()` updates dims and preserves content | Risk #1 from `.planning/v3.2-headless-serialize-assessment.md`. Drift = malformed snapshots on the client. |
| `test-dispose.js` | 100 create/dispose cycles complete without throwing | Risk #3 from the assessment. Memory leaks from undisposed terms = ~750 KB each over server lifetime. |
| `test-multi-session.js` | Per-session isolation -- no cross-session content leakage | Multi-session is a core capability. Bugs here would mix users' content across sessions. |
| `test-server-syntax.js` | `server.js` passes `node --check` AND headless deps `require()` cleanly | Catches typos, broken requires, missing braces. Cheap pre-deploy gate. |

## Adding tests

1. Create `tests/test-<name>.js`.
2. Use the helpers in `tests/helpers.js` (`makeTerm`, `write`, `stripAnsi`, `assert`).
3. Each test is a standalone async IIFE that exits 0 on success.
4. `npm test` auto-discovers any `test-*.js` file.

## What these tests do NOT cover (yet)

- **End-to-end flow with a real PTY.** Requires WSL + dtach + node-pty in the test environment. Out of scope for this suite. Smoke-test manually via `bash update.sh` then exercising the iPhone UI.
- **Encryption layer.** v3.2 doesn't touch the WebSocket / ECDH / AES-GCM path; existing TOTP and identity-key tests in upstream cover that.
- **Network reconnect / dtach recovery.** Integration territory -- harder to test in isolation. Mitigated by careful audit-log review post-deploy.
