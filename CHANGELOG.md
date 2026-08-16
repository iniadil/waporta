# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Addresses three recurring user reports: sends reported as successful that never
arrived, freshly paired numbers getting banned after a single message, and the
absence of any message trail. No breaking changes to existing API contracts, but
three defaults change behavior — see "Changed".

### Added

- **Real delivery status.** `/send/*` now returns `messageId` and `ack` alongside
  the unchanged `status: "sent"`. New endpoint
  `GET /api/whatsapp/messages/{messageId}` reports the actual state
  (`socket` → `pending` → `server` → `delivered` → `read`). A message stuck at
  `socket` is the signature of the "said sent but never arrived" case.
  State is in-memory (`src/lib/message-state.ts`); see README for its limits.
- **Direct Baileys event subscription** (`src/lib/wa-events.ts`). `wa-multi-session`
  discards all but the first element of each `messages.update` batch and never
  forwards the disconnect reason, so waporta subscribes to `sock.ev` itself via
  the public `getSessionById()`. No additional `node_modules` patches were needed.
- **Status webhooks** — opt-in `message.status` event via `WEBHOOK_STATUS_EVENTS=true`.
  Off by default; a single message produces three or four such events. The
  existing `message.received` payload is unchanged.
- **Ban detection.** A session rejected by WhatsApp with `403 forbidden` is
  recorded persistently, triggers the failure notifier with `"kind": "session"`,
  and causes further sends to return `403 session_banned` instead of a misleading
  `503 session_unavailable`. `badSession` (500) is deliberately **not** treated as
  a ban — in Baileys it is the fallback code for any unrecognized stream error,
  so acting on it would condemn healthy numbers.
- **Persistent session health** (`data/session_health.json`) — first-connect time,
  the owning JID, and daily send counters survive restarts, so guards no longer
  lose their memory. On the first start after upgrading, sessions that already
  exist are marked mature exactly once, so a deploy does not treat long-running
  production numbers as freshly paired. Reusing a `sessionId` with a different
  phone number resets its history.
- **Gradual daily quota** for new sessions: `SEND_RAMPUP_DAILY` (default
  `20,50,100,200`), reported as a distinct `429 daily_quota_exceeded` because it
  only resets at midnight — unlike `rate_limited`, which clears in seconds.
- **Optional message log** — `MESSAGE_LOG_LEVEL=off|meta|full`, appended as JSONL
  to `data/logs/YYYY-MM-DD.jsonl` with daily rotation and 7-day retention. Off by
  default. At `meta` level, phone numbers are masked and message content is not
  stored. Roughly 200 KB/day at 1000 messages/day. Write failures degrade
  silently and can never fail a send.
- New environment variables: `SEND_WARMUP_COLD_MS`, `SEND_WARMUP_RECONNECT_MS`,
  `SEND_RAMPUP_DAILY`, `SEND_RETRY_ON_TIMEOUT`, `SEND_MAX_RETRIES`,
  `SEND_RETRY_BASE_DELAY_MS`, `MESSAGE_STATE_MAX`, `MESSAGE_STATE_TTL_MS`,
  `WEBHOOK_STATUS_EVENTS`, `MESSAGE_LOG_LEVEL`, `MESSAGE_LOG_RETENTION_DAYS`,
  `MESSAGE_LOG_MAX_BYTES`, `LOG_MESSAGE_PAYLOAD`.

### Changed

- **Timeouts are no longer retried by default.** Baileys wraps the websocket
  write in a timeout, so a timeout can fire after the frame already reached
  WhatsApp — retrying then delivers the message twice. Restore the old behavior
  with `SEND_RETRY_ON_TIMEOUT=true`.
- **Warm-up is now two-tier.** A newly paired number waits 30 minutes
  (`SEND_WARMUP_COLD_MS`); a session that merely reconnects waits 1 minute
  (`SEND_WARMUP_RECONNECT_MS`) instead of the previous flat 5 minutes. Setting
  the legacy `SEND_WARMUP_MS` still overrides both, including `0` to disable.
- **Incoming messages are no longer dumped to stdout in full.** The default log
  line is now a one-line summary; conversation content is printed only with
  `LOG_MESSAGE_PAYLOAD=true`.
- `docker-compose.yml` now forwards the `SEND_*`, `MESSAGE_*`, `DEFAULT_API_KEY`,
  and logging variables to the container. Previously none of the anti-ban
  variables were passed through, so they had no effect under Docker.

### Fixed

- `sendWithRetry` no longer discards the result of the send call, which had been
  throwing away the only identifier linking a request to its delivery status.
- A request rejected by one guard no longer consumes the rate-limit window or the
  daily quota; both are recorded only after every check has passed.

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
