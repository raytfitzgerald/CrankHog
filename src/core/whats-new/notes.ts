// What's new: the short version of each release, shown once after an update.
// The full notes live in docs/releases/v<version>.md and on the GitHub release;
// this is the part a rider reads before getting on the bike.
//
// Every release adds an entry here (tests/unit/whats-new.test.ts fails a
// version bump without one). Newest first. Keep it brief: one line that says
// what changed for the rider, then up to four short points, in the app's voice
// (docs/BRAND.md: plain, specific, no exclamation marks or hype).

export interface WhatsNewEntry {
  /** The app version, as in package.json. */
  version: string
  /** The release in one sentence. */
  title: string
  /** One to four short points. */
  points: string[]
}

export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    version: '1.0.0',
    title: 'CrankHog 1.0: a training calendar and plans, and a ride clock that waits for you.',
    points: [
      'Calendar in the sidebar: put workouts on days, mark events and days off, and build a training plan for an event, with or without AI.',
      'The ride clock starts at your first pedal stroke, and Strava shows the same time as CrankHog. Pick the line under each upload in Settings → Strava & sync.',
      'Countdown beeps before each workout step ends, and spin-down calibration for trainers that support it (Devices, then Calibrate).',
      'Coasting downhill keeps you rolling instead of pausing, and free rides and ERG workouts measure distance from your power, not your gear.',
    ],
  },
  {
    version: '0.6.4',
    title: 'Heart-rate straps that are slow to connect get the time they need.',
    points: [
      'Some straps, like the Garmin HRM 200, showed up in Devices and then failed to connect. Connecting now waits up to 30 seconds for them.',
      "Reading from and writing to a device still gives up after 4 seconds, so a trainer that stops answering can't hold up a ride.",
    ],
  },
]

/** The GitHub release page with the full notes for a version. */
export function releaseNotesUrl(version: string): string {
  return `https://github.com/raytfitzgerald/CrankHog/releases/tag/v${encodeURIComponent(version)}`
}
