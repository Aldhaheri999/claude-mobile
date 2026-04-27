# Changelog — Aldhaheri999 fork

All notable changes vs. upstream `Mister-ams/claude-mobile`. Each entry is
self-contained: what changed, why, where the code lives, and how to verify it.
Newest at top.

---

## v3.2.1 — 2026-04-27

### Reduce iPhone fontSize 13 → 11 to widen effective cols

**The change.** `public/index.html`: `Terminal({ fontSize: 11, ... })` (was 13).
Updated the matching `charW` constant (used in initial cols calculation) from
`7.8` to `6.6`.

**Why.** After v3.2.0 deployed, the user reported continued text overlap on
iPhone. Investigation: `node scratch/test-headless.js` rendered the captured
Claude Code banner cleanly (proves v3.2's byte layer is correct). But at
cols=46-50 (the iPhone's effective width with fontSize 13), Claude Code v2.x's
TUI itself positions multiple UI elements (status separator, "[ waiting for
first message ]", "Opus 4.7" model indicator, "◉ xhigh · /effort" effort badge)
at cell coordinates that **collide** -- those elements are designed for cols
≥80. At narrow cols xterm.js writes them to overlapping cells, the second
write overwrites the first, and the visible result is fragments of multiple
elements appearing on the same row.

This is **upstream of v3.2** -- Claude Code's narrow-terminal TUI behaviour,
not anything claude-mobile can fix at the byte/buffer/transport layer.

**Mitigation, not a full fix.** Reducing fontSize widens the effective cols
on iPhone:
- fontSize 13 → cols ≈ 46 (collisions present)
- fontSize 11 → cols ≈ 57 (collisions reduced but not eliminated)
- fontSize  9 → cols ≈ 70 (likely clean, but small to read)

Settling on 11 as a readability/cleanness compromise. If 11 is still
problematic, the next lever is fontSize 10 or 9 -- one-line edit at
`public/index.html:858`.

**Verification.** Test runs confirmed the overlap is in the source bytes, not
the v3.2 layer:
```
cols=46: row text 644 chars (multiple UI elements jammed onto one cell row)
cols=80: row text 435 chars (elements have natural separation)
cols=100: row text 266 chars (clean)
```
The headless terminal correctly applies all writes -- the overlap is faithful
to Claude Code's intent at narrow widths.

**No test added.** This fix is environmental (depends on real iOS Safari font
metrics), not algorithmic. Existing v3.2.0 tests still pass.

**Rollback if it makes readability worse.** Single-line revert to fontSize 13
at `public/index.html:858`.

---

## v3.2.0 — 2026-04-27

### Migrate scrollback to `@xterm/headless` + `@xterm/addon-serialize`

**The change.** The server used to store every PTY byte in an append-only
`session.scrollback` string (capped at 400 KB) and dump that raw history on
phone reconnect. Now each session owns a server-side **headless xterm.js
terminal** that *interprets* PTY bytes into a virtual screen+scrollback grid.
On reconnect, the server sends a serialized snapshot of that grid instead of
the raw byte history.

**Why.** The append-only string preserved every byte ever sent — including
every Claude Code welcome banner from every restart. After 3 restarts the
phone's scrollback showed 3 stacked banners (the user's reported bug). The
headless terminal honours `\x1b[2J` clear-screen escapes the way a real
terminal does — when Claude Code restarts and clears the screen, the prior
banner cells are overwritten in memory and gone from the snapshot. Banner
deduplication happens for free, structurally, instead of via the brittle
v3.1.7 truncation heuristic.

**Pipeline impact.** Isolated to the buffer-and-replay layer. Live streaming,
encryption (ECDH + AES-GCM), authentication (WebAuthn / TOTP / identity-key
TOFU), Tailscale transport, dtach persistence, and the iPhone client's
xterm.js renderer are **all unchanged**. Memory: ~750 KB per session vs. the
old 400 KB cap (~2× per session — negligible). Reconnect payload: typically
5-50 KB vs. up to 400 KB (~10× smaller — faster reconnects on cellular).
Trade-off: animation frames (spinner history, etc.) are no longer replayed
on reconnect — you see the final state instead. Acceptable.

**Files changed.**
- `package.json` — added deps: `@xterm/headless ^6.0.0`, `@xterm/addon-serialize ^0.14.0`. Both maintained by the xterm.js team / Microsoft. MIT licensed. Pure JavaScript, no native bindings.
- `server.js`:
  - `makeHeadlessTerm(cols, rows)` helper at top — instantiates headless terminal + serializer pair.
  - Removed `SCROLLBACK_SIZE = 400000`. Replaced with `HEADLESS_SCROLLBACK_ROWS = 1000`.
  - `wireSessionProc.onData` (~line 1096) — replaced raw `session.scrollback += data` (and the v3.1.7 truncation heuristic) with `session.headless.write(data)`.
  - `createSession` (~line 1175) — instantiates `session.headless` + `session.serializer` at session-create time.
  - `recoverDtachSessions` (~line 1224) — instantiates a fresh headless terminal for each recovered dtach session.
  - `case 'connect'` (~line 1474) — sends `session.serializer.serialize({ scrollback: 1000 })` instead of the raw scrollback string.
  - `case 'resize'` (~line 1529) — also calls `session.headless.resize(cols, rows)` to keep dims in sync with the PTY (critical: drift causes malformed snapshots).
  - `case 'close'` (~line 1552) — calls `session.headless.dispose()` to free memory.
  - PTY `onExit` cleanup (~line 1167) — calls `session.headless.dispose()` when the dtach session is gone.
- `public/index.html`:
  - `case 'scrollback':` (~line 789) — collapsed the chunked-replay loop (50 lines per chunk, async writeNextChunk) into a single `term.write(snapshot, callback)`. The serialized payload is small enough that chunking added no value.
- `README.md` — version bump and one-line description of the new architecture.
- `CHANGELOG.md` — this file (new).

**How to verify it works.**
1. Run `node scratch/test-headless.js` — this writes the captured Claude Code banner 3× into a headless terminal and asserts the serialize() output contains exactly 1 banner. (Reproduces the original symptom in isolation.) Expected: `Human-readable banner count in snapshot: 1`.
2. Run `node scratch/test-headless-suite.js` — full test suite covering: write/serialize round-trip, resize handling, UTF-8 split across chunks, dispose lifecycle, multiple parallel sessions, scrollback row depth.
3. Run `node -c server.js` — syntax check.
4. On the laptop: `bash update.sh` to deploy. On the phone: hard-refresh Safari, start a fresh session, exit Claude Code (`/exit`) and re-launch (`claude`) three times. Open the session — should see exactly **one** welcome banner in scrollback, plus the most recent prompt.

**Risks and mitigations.**
- *Headless dims drift from PTY dims* — addressed by mirroring every `resize` to `session.headless.resize()`. Test in suite.
- *Memory leak from undisposed sessions* — addressed by `dispose()` in both `case 'close'` and `onExit`. Watch RSS in PM2 logs for a week post-deploy.
- *UTF-8 chunk boundaries* — xterm.js handles partial multi-byte chars internally. Test in suite covers this.
- *Deploy disrupts live sessions* — dtach sessions survive the server restart, but the headless term starts empty. First reconnect after deploy shows current screen only (no pre-deploy history). One-time disruption per session.

**Rollback.** If anything breaks badly: `git revert 99a564f^..HEAD` and `bash update.sh`. Sessions persist via dtach; only the buffer/replay layer reverts.

**Related.** Architectural assessment lives at `.planning/v3.2-headless-serialize-assessment.md`.

---

## v3.1.7 — 2026-04-27 *(superseded by v3.2.0)*

### `fix(scrollback): truncate at TUI repaint escapes; revert misdiagnosed v3.1.6`

**The change.** Server-side: when incoming PTY data contained `\x1bc` (RIS),
`\x1b[3J` (erase scrollback), or `\x1b[2J` (clear entire screen), `server.js`
truncated `session.scrollback` at the most recent such escape. Net effect:
each Claude Code restart left only the most recent banner in the buffer.

**Why.** The original symptom report ("text repeats over each other on the
iPhone") was first parsed as a *renderer* bug. v3.1.6 attempted a
Canvas-renderer-on-iOS swap that turned out to fix nothing in Playwright
WebKit testing at iPhone viewport. The actual bug was content duplication
in scrollback — banner draws accumulating across Claude Code restarts inside
the persistent dtach session. v3.1.7 reverted v3.1.6 and added a heuristic
truncation as a stop-gap.

**Files changed.**
- `public/index.html` — reverted v3.1.6 iOS Canvas-renderer branch back to upstream's WebGL-first / Canvas-fallback path.
- `server.js` — added repaint-escape regex `/\x1bc|\x1b[3J|\x1b[2J/g` in the `wireSessionProc.onData` handler. When a match is found in incoming data and the buffer already had content, the buffer is reset to `data.slice(matchIdx)`.
- `package.json` — `3.1.6 → 3.1.7`.
- `README.md` — version bump and changed description.

**Status.** Superseded by v3.2.0's structurally-correct headless-terminal
approach. The truncation code was removed in v3.2.0.

**Trade-off (now moot).** Lost any scrollback content from before the most
recent screen-clear. v3.2.0 doesn't have this trade-off — real history
survives across TUI restarts because the headless terminal preserves
scrollback rows independently of visible-screen clears.

---

## v3.1.6 — 2026-04-26 *(reverted in v3.1.7)*

### `fix(ios): use Canvas renderer on iOS Safari to stop TUI banner from stacking lines`

**The change.** Detected iOS via UA + `navigator.maxTouchPoints` heuristic and
loaded `CanvasAddon` directly instead of `WebglAddon` for those clients.
Other platforms continued with WebGL primary, Canvas fallback.

**Why I shipped it.** I (Claude) misdiagnosed the user's bug report
("text repeats over each other") as a WebGL cell-alignment bug on iOS WebKit.
A prior session's analysis pointed at xterm.js's WebGL renderer as the
likely culprit. I committed without verifying.

**Why it was reverted.** Subsequent Playwright testing with WebKit at
iPhone 13 viewport showed identical clean rendering with both Canvas and
WebGL renderers — neither reproduced the symptom. The user confirmed "still
not fixed" after the deploy. Root-cause analysis (banner-byte capture +
hex dump + escape-sequence summary) revealed the actual bug was content
duplication in scrollback, not a renderer alignment issue. v3.1.6 added no
value and cost WebGL performance on iOS.

**Lesson recorded.** Don't ship fixes based on hypotheses without
reproducing the bug first. v3.1.7's commit message captures the rationale.

---

## v3.1.5 — *(upstream baseline + local TOTP hardening)*

The fork's starting point. All commits up to and including the TOTP-secret
hardening work (atomic writes, backup recovery, graceful SIGINT/SIGTERM
shutdown) — see commit `80f6140` for details.
