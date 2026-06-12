# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-06-13

This release hardens waporta against WhatsApp account bans and upgrades the
underlying Baileys protocol library. It contains **breaking changes** for API
consumers — read the "Changed" section before upgrading.

### Security

- Upgraded Baileys from `7.0.0-rc.6` to `7.0.0-rc13` (pinned via the npm
  `overrides` field on `wa-multi-session`). `rc12` patched a security
  advisory; `rc13` is the latest release candidate. Existing sessions may need
  to be re-paired after upgrading.

### Added

- **Anti-ban guards** (`src/lib/session-guard.ts`, `src/lib/send-guard.ts`):
  - **Warm-up window** — outgoing messages are rejected for a configurable
    period after a session connects/reconnects (default 5 minutes).
  - **Per-session rate limit** — sliding window, default 20 messages / 60 s.
  - **Recipient check** — every non-group send is validated with `isExist`
    first; messages to unregistered numbers are rejected.
  - **Typing simulation** — a randomized "composing" indicator is shown before
    each send to produce human-like timing.
- **New HTTP error responses** on the send endpoints, documented in the OpenAPI
  spec: `422 recipient_not_found`, `429 session_warming_up`,
  `429 rate_limited` (with `retryAfterMs`), `503 session_unavailable`.
- **New environment variables** (all optional, see `.env.example`):
  `SEND_WARMUP_MS`, `SEND_RATE_MAX`, `SEND_RATE_WINDOW_MS`,
  `SEND_TYPING_MIN_MS`, `SEND_TYPING_MAX_MS`. Set any to `0` to disable.
- **`patch-package` integration** (`patches/`): fixes carried until merged
  upstream — `wa-multi-session` reconnect behavior and `whatsapp-rust-bridge`
  package `exports` resolution. Applied automatically via the `postinstall`
  hook.
- **MIT `LICENSE`** and this `CHANGELOG.md`.
- `WA_DISABLE_AUTOLOAD` env flag so `npm run gen:swagger` / CI can build the
  OpenAPI spec without opening real WhatsApp connections.

### Changed

- **BREAKING:** Send endpoints (`POST /api/whatsapp/send/{text,image,document}`)
  now run anti-ban checks before dispatching. Integrations that send to
  unregistered numbers, or burst messages immediately after pairing, will now
  receive `422`/`429` responses instead of a delivery.
- **BREAKING:** Installation requires **npm**. The `overrides` field and the
  `patch-package` `postinstall` hook are npm-specific — `pnpm` and `yarn` will
  not apply the Baileys pin or the patches.
- **BREAKING:** Minimum Node.js version is now **20** (required by Baileys
  `rc13`).
- Device fingerprint changed from `Ubuntu/Chrome` to `macOS/Chrome` (the Baileys
  default, a less unusual signal).
- Patched `wa-multi-session` reconnect logic: stops reconnecting on `loggedOut`
  (401), `forbidden` (403), and `badSession` (500); other disconnects now use
  exponential backoff with jitter instead of immediate retries. Sessions are
  also started with a stagger at boot.
- Retry logic now adds jitter and only retries genuinely transient network
  errors (`timeout`, `etimedout`, `econnreset`); connection-drop errors are no
  longer retried to avoid hammering a just-disconnected socket.
- Incoming-message webhooks no longer fire for `fromMe` (self/outgoing)
  messages, preventing reply-loops on auto-reply consumers.
- `package-lock.json` is now committed (removed from `.gitignore`) for
  reproducible installs.
- Docker build now uses `npm ci`, copies `patches/` before install, and the
  unused `baileys_store.db` volume mount was removed (the session DB lives in
  `wa_credentials/database.db`).

### Fixed

- Reconnect storm on banned sessions: a `403 forbidden` disconnect no longer
  triggers up to 10 immediate reconnect attempts.
- `npm install --omit=dev` (Docker production stage) no longer fails: patches
  apply because `patch-package` is a production dependency and `patches/` is
  copied into the build.
