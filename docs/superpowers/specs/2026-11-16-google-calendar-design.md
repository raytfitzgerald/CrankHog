# Google Calendar for CrankHog: design

## Context

Riders plan their training on CrankHog's calendar (1.0.0, multisport in 1.0.1). They want that plan next to the rest of their life. They sign in with their Google account once. From then on, every planned workout appears as an all-day event in a Google calendar named "CrankHog". When a workout moves on CrankHog's calendar, it moves in Google too.

The fork's `main` was synced with Ray's 1.0.1 before this work started, and this branch builds on it.

## Goals
- Sign in with Google from the Mac app. No tokens reach the renderer.
- Every planned entry in `schedule` appears in Google as an all-day event: bike workouts and planned runs, swims and other sessions.
- Adding, moving, renaming or removing an entry, re-laying a plan, and importing from intervals.icu all reach Google within seconds. Changes made offline go across later.

## Non-goals
- Events (races) and days off. They aren't sent.
- Reading anything back from Google, or treating Google as a second place to plan.
- The web and iPhone builds. They have no safe store for tokens yet, the same as Strava and intervals.icu.

## Anti-goals
- Touching the rider's own calendars or events. The scope only reaches calendars this app created, and only events CrankHog tagged are ever changed.
- Duplicate events after retries, a reconnect, or a plan re-lay.
- Rewriting history: events older than 30 days are left alone.

## Approaches considered
1. **Push on each action**, as intervals.icu does (`intervals-push.ts`, called from `moveScheduled`, `removeScheduled` and the plan re-lay). Small, but every new way of changing the calendar needs its own hook. New entries, renames and imports would each need one, and a change made while offline would be lost.
2. **An outbox of changes** in main, like `UploadOutbox`. Durable, but it duplicates state and needs a change log for Dexie, which has none.
3. **A stateless mirror (chosen).** The renderer sends the whole window of planned entries, debounced, whenever anything it reads changes (Dexie `liveQuery`). Main lists the CrankHog calendar, diffs, and applies the result. It heals itself and needs no new tables. A sync costs one list call when nothing changed.

The rider asked for the feature and handed over the how. The base branch, what syncs, and where the Google app comes from were the rider's to pick. They didn't choose, so the recommended options went ahead and are flagged below.

## Design

**Core** (`src/core/calendar-mirror/`, pure and tested):
- `mirror.ts`:
  - `MirrorEvent { key, date, title, description }`, where `key` is the schedule entry's id.
  - `googleEventId(key)`: a deterministic base32hex id, `ch` plus four hex digits per UTF-16 unit. A retried insert therefore hits a 409 instead of making a duplicate.
  - `fingerprint` (FNV-1a).
  - `diffMirror(desired, actual, windowStart)`. It only touches events with a key, never anything before the window, rewrites an event on a fingerprint or day mismatch, and removes duplicates. The 30-day window is `MIRROR_PAST_DAYS`.
- `event-text.ts`:
  - The title is the entry's name.
  - The description is the sport (and label), length, distance, effort, then TSS or load, then the notes, then a footer saying the calendar follows CrankHog. Sentence case, no emoji.

**Main:**
- `integrations/google.ts`: `GoogleClient`.
  - Sign-in: loopback OAuth with PKCE (S256), `access_type=offline` and `prompt=consent`. Scopes are `openid email calendar.app.created`. A grant with the calendar box unticked is refused.
  - Tokens and calendar: refresh happens below five minutes left. A refused refresh signs the rider out (`GoogleAuthError`). Disconnect revokes the grant.
  - Calendar calls: the calendar is created once per account. Event list, insert, update and delete are here too. A 409 on insert becomes an update that restores the event; if that fails, the event is inserted under an id Google picks.
  - Events are all-day, `transparent`, have no reminders, and carry `crankhogKey` and `crankhogFp` in their private extended properties.
- `integrations/google-calendar-sync.ts`: `GoogleCalendarSync`.
  - One sync runs at a time, and only the newest snapshot is kept.
  - A deleted calendar is recreated.
  - It backs off on 429, 5xx, network errors and Google's rate-limit 403s, honouring Retry-After. Any other refusal waits for the next snapshot.
  - Status is pushed on `google.calendar.changed`.
- `integrations/oauth-loopback.ts`: the loopback listener, moved out of `strava.ts` and now shared by both sign-ins.
- `integrations/google-app.ts`: CrankHog's own Google app, defined at build time from `CRANKHOG_GOOGLE_CLIENT_ID` and `CRANKHOG_GOOGLE_CLIENT_SECRET` (`electron.vite.config.ts`). It is never committed. CI passes them to the macOS build that makes the DMG from two repo secrets of the same names (`.github/workflows/ci.yml`); pull requests from forks get none, so their builds use the rider's own app. A local `npm run dist` can set the same variables. The DMG riders actually download is the signed one `npm run dist:signed` builds on the release Mac, which replaces CI's, so that script takes the app from the keychain (service `crankhog-google`, or the same variables), refuses to build without it, and checks that the built main process carries the client ID (`scripts/google-app.mjs`).
- `ipc/google-handlers.ts`: the `google.status`, `google.setApp`, `google.connect`, `google.disconnect` and `google.calendar.sync` channels. A sync is ignored unless the setting is on and the rider is signed in. A new sign-in turns the setting on.

**Renderer:**
- `plan/google-mirror.ts`:
  - `mirrorSnapshot` builds the window. Bike workouts get their planned length and TSS at the current FTP, through the library's `describeWorkout` and `plannedStatsOf`.
  - `startGoogleMirror` watches with `liveQuery`, waits for 2 s of quiet before sending, and skips a snapshot identical to the last one sent.
  - It also sends when the rider signs in or switches the sync on, and every hour anyway (to move the window and put dragged events back).
- `features/settings/GoogleCalendarSection.tsx` sits under Settings, Strava & sync, and is hidden in the web and iPhone builds. It has:
  - sign in and sign out;
  - the sync switch, its status line, **Update now** and **Open Google Calendar**;
  - the own-app form when the build has no built-in app.
- Setting: `googleCalendar.enabled` in `src/shared/settings.ts`, a new key that defaults to off.

## Calls made by the builder (rider can override)
- **Base:** this fork's `main` after syncing with Ray's 1.0.1, which holds the calendar.
- **What syncs:** all planned sessions, not events or days off.
- **Google app:** both. The built-in app is used when the build carries one; otherwise the rider pastes their own Desktop OAuth client. Shipping the built-in one needs a Google Cloud project owned by whoever publishes the app, and Google's OAuth verification for public use, which requires the privacy policy page on the site.
- **A separate calendar named "CrankHog"**, never the primary calendar.
- **Sign-out keeps the calendar** in Google. The message says how to delete it.
- **One calendar per Google account.** Main keeps each account's calendar id (secrets key `google.calendars`, which absorbs the earlier single `google.calendar`), so switching accounts never makes a second calendar. The scope can't list calendars (`calendarList.list` needs `calendar.calendarlist.readonly` or wider, which would widen consent and review), so a new Mac can't find the old calendar by itself. Instead the renderer keeps the ids in the `kv` table under `googleCalendar.calendars`, which backups carry, and sends the account's one as `calendarHint`. Main adopts it when `calendars.get` confirms this app can still reach it, else makes a new calendar. A new Mac without a backup still gets a second calendar; the README says to delete the old one.
- **Refusals are per change.** A change Google refuses outright (a 4xx that isn't a rate limit) is counted and skipped, and the rest of the sync goes through; the status reports how many and Google's reason for the first. Retryable errors and a lost sign-in still stop the sync for a retry. An update to an event deleted in Google since the list becomes an insert.
- **Testing mode signs riders out weekly.** While the Google project is in Testing, Google expires refresh tokens after 7 days. CrankHog then shows "sign in again" (`GoogleAuthError`), which is Google's rule, not a bug. Publishing the app ends it: unverified (a 100-user cap and a warning screen) or verified.
- **Swim distances** in event descriptions use `formatSportDistance` (metres or yards), like the calendar since #61.
- **Session steps in the event.** A run, swim or other session's description carries its steps as in its `.txt` file, without CrankHog's header lines (`session.text`, else the library session's body), between the summary and the notes. Steps are capped at 6000 characters and notes at 1500, cut at a line break with "…", so a description stays inside the 8000-character limit. Bike workouts keep the summary and their description.
- **No reminders, shown as free time.** A planned workout shouldn't block the day or ping the rider's phone.
- **CrankHog's day wins.** An event dragged in Google goes back. A title edited in Google stays until the entry changes in CrankHog.

## Left to whoever ships it
- Create the Google Cloud project, the consent screen and the Desktop OAuth client, set the two CI secrets for release builds, and go through verification.
- Check during the first real sign-in that Google grants `calendar.app.created` to the app. If a project can't get it, `CALENDAR_SCOPE` falls back to `https://www.googleapis.com/auth/calendar`, and the consent text grows accordingly.
