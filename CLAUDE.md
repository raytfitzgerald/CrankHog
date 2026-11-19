# CrankHog: notes for Claude

A macOS Electron + React/TypeScript indoor-cycling trainer (ERG/SIM control, workout builder, FTP tests, FIT export, Strava, optional AI). It is a **public repo**: never commit secrets, personal ride data, or code copied from GPL/AGPL projects.

## Commands
- `npm run check`: tsc (core/node/web projects), eslint with import boundaries, vitest. Must be green before any commit.
- `npm run e2e`: builds, then runs the Playwright `_electron` specs in `tests/e2e`.
- `npm run dev`: the app; it rebuilds and restarts the main process when its code changes (`--watch`), so a `git pull` never leaves an old main process behind a new window. `npm run dev:web`: renderer only, in a browser, with simulated devices.
- `npm run dist` then `npm run selftest:packaged`: builds the DMG and verifies it boots. Playwright can't drive the packaged app, because the fuses disable `--inspect`.

## Architecture rules (enforced)
- `src/core` is pure TS: no DOM, Node, Electron, React or Dexie. `tsconfig.core.json` only knows ES2023 plus `src/core/host.d.ts`. Put anything testable here.
- `src/shared` holds the IPC contract (`ipc/contract.ts`, zod). Add every new channel to `ipc/channels.ts` too; a test enforces this.
- Renderer ↔ main traffic goes only through `window.crankhog.invoke/on`. Main validates every payload and checks the sender.
- Secrets live only in main (`safeStorage`). The renderer never sees API keys or OAuth tokens.
- The `app://freegaz` origin must never change, or IndexedDB data is orphaned. It keeps the old name after the CrankHog rename on purpose; users never see it. The iOS bundle id stays `io.github.raytfitzgerald.freegaz` too, or App Store updates break.
- The GitHub repos were renamed to `raytfitzgerald/CrankHog` and `…/CrankHog-site` in 0.6.0, before 0.6.0 shipped. The updater feed (`electron-updater.ts`) and the publish target (`electron-builder.yml`) must always name the same repo; they disagreed between the rename commit and this one, which would have shipped a 404 feed. The web app moved with it, to `raytfitzgerald.github.io/CrankHog/`.
- `productName` moved to `CrankHog` in 0.6.0. `src/main/user-data.ts` renames the old Application Support and Documents folders on first launch; don't change it again without a migration.

## Domain rules
- **Missing is not zero.** A sensor value past its TTL is `null` (FIT invalid), never 0. Averages and NP skip nulls.
- Records are one per second of *moving* time. Pauses and laps take effect on slot boundaries.
- Each ride snapshots FTP, weight and zones. Simulated or time-warped rides are flagged, and excluded from Strava, PMC and FTP auto-save.
- FTMS first; the Wahoo proprietary protocol is only a fallback. Never drive two control protocols at once. Keep one GATT operation in flight per device.
- AI never runs inside the ride tick. It gets only data kept in CrankHog, never data pulled from Strava (intervals.icu never passes Strava activities on). The coach chat gets all of it, rides, other sports, plans and the calendar (`src/core/ai/athlete-context.ts`); the rider's name never leaves the Mac.
  - The coach chat changes things only through a card the rider applies. Its tools (`src/core/ai/coach-tools.ts`: native tool calls, or a fenced `crankhog-tool` block for Ollama) propose changes, checked in `src/core/coach-actions/actions.ts` and applied and undone in `src/renderer/src/ai/coach-actions.ts`, or draft a plan (`src/core/coach-plan/`, `src/renderer/src/ai/coach-plan.ts`). A change to a session applies to that day only: it gets a new library workout tagged `coach`, never an edit of the shared one. Sessions imported from intervals.icu aren't rewritten (the next import would undo it), and nothing is planned on a day that has passed.
  - Claude Desktop and Claude Code reach CrankHog over MCP, off until the rider turns Claude on in Settings → AI. The add-on (`resources/mcp/crankhog-mcp.mjs`, also packed as a `.mcpb` by `src/main/mcp/addon.ts`) speaks MCP's initialize handshake over stdio and passes calls over a 0600 Unix socket in `userData/mcp` to `src/main/mcp/server.ts`, which checks every input (`src/core/mcp/tools.ts`) and hands it to the page (`src/renderer/src/mcp/tools.ts`). Reads are the coach chat's context; changes apply at once (Claude asks the rider first) through the same coach-actions and plan-import code, and each is listed with Undo in Settings → AI. The add-on runs on Claude Desktop's own Node: keep it one file with no dependencies. Tool descriptions and the instructions stay under 4,096 characters (Claude Code cuts there; a test checks).
  - A custom coach's master prompt (`instructions`) and the rider's notes for every coach (`settings.coach.notes`) go with chat, debrief and the fitness overview (`coachVoice`), never with the prompt that writes ride lines.
- Ride with others (beta, November 2026): CrankHog speaks OpenBikeNet protocol v0 (github.com/OpenBikeNet/protocol, a draft) on the shared tracks. The protocol and connection logic are `src/core/openbikenet/` (`session.ts`, tested without a network); the WebSocket lives in main (`src/main/ipc/group-ride-handlers.ts`), because the page's CSP only allows `connect-src 'self'`; the page says what it wants once a second (`src/renderer/src/group-ride/runtime.ts`). Mac app only. Off until the rider turns it on; the display name is the rider's own choice, never the athlete profile's. Simulated rides never join a server other than one on this Mac. Shared tracks are built from the network's route JSON (`tracks.ts`) at their exact published length, never from a GPX or smoothed. `src/main/group-ride/stand-in-server.ts` is a stand-in server written from the spec, for tests: the regular tests never touch the public server; only the opt-in live checks do (`CRANKHOG_LIVE_OBN=1`: `src/main/group-ride/live.test.ts`, `tests/e2e/group-ride-live.spec.ts`). Every connection's app ID and version show up in the server's public stats, so the checks' own connections use `crankhog-live-check` (`live-check.ts`), never `crankhog`, and a real version, never a made-up one. Never copy code from the AGPL reference server.
- Personas: CrankHog is an adult app and the coaches may be as mean as they like, about anything (Ray's decision, November 2026). The one guardrail is self-harm (`src/core/persona/guardrails.ts`): no line, canned, user-made or AI-written, tells the rider to hurt or kill themselves, at any language setting. The distress switch still drops the act when the rider's heart rate looks wrong.
  - Coaches that parody real people are hidden in the iPhone build (`src/renderer/src/coach/available.ts`), for App Review.
  - New photo heads: Ray approves the exact files first. Credits go in `src/renderer/src/coach/toon/heads/ATTRIBUTION.md`.

## Brand
- Follow `docs/BRAND.md`. Use theme tokens only (`bg-panel`, `text-ink-dim`, `bg-accent text-on-accent`…), never literal colours; brand constants (`stayer`, `sprinter`, `azure`) are for the logo and track lines, not UI states.
- Numbers and headings use `font-display` (Saira, condensed, tabular); small uppercase labels use `eyebrow`; everything else is Atkinson (`font-sans`, the default).
- Sentence case, no exclamation marks or emoji in the interface; the coaches have the personality.

## Conventions
- Match surrounding style: small modules, named exports, zod at trust boundaries, and no default exports except React entry points.
- Tests sit next to the code (`*.test.ts`); simulator scenarios go in `tests/sim`, E2E in `tests/e2e`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Never rename a persisted key.** The `app://freegaz` origin, the Dexie database name (`src/renderer/src/db/db.ts`), the `freegaz.web.*` localStorage keys and Strava's `freegaz-<rideId>` external id all keep the old brand on purpose. Renaming any of them orphans a rider's data.
- Sir Loin the hog is the mascot. `src/core/mascot/`: `hog.ts` is who he is and when he turns up, `stunts.ts` what he does about the road, `race.ts` the race you can have with him, `crank.ts` the secret on Home (click him and he laps faster, then the two wolves; not in the iPhone build, and kept out of What's new and the README). `src/renderer/src/brand/hog/` draws him. His rules, including that he is never the butt of a joke about what he's made of, are in `docs/BRAND.md`.
- The full plan and research notes are at `~/.claude/plans/i-would-like-for-foamy-moth.md` (local only).
