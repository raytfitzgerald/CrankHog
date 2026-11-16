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
    version: '1.0.3',
    title: 'Your planned training, in Google Calendar.',
    points: [
      'Click Connect Google Calendar at the top of the calendar, or find it in Settings → Strava & sync. Every planned session then shows as an all-day event in a calendar named CrankHog.',
      'Add, move, rename or remove a session here and Google follows within seconds. Changes made offline go across later.',
      'CrankHog can only reach the calendar it made. Your other calendars and events stay out of its hands.',
      "Google may say it hasn't verified CrankHog yet. Choose Advanced, then Go to CrankHog.",
    ],
  },
  {
    version: '1.0.2',
    title: 'Swims count by distance in each week, in metres or yards.',
    points: [
      "The Swim line beside each week shows the distance you swam against the distance planned, in your units, with the time beside it.",
      'A swim planned by time alone keeps its time there: "1,800 m + 45 min".',
    ],
  },
  {
    version: '1.0.1',
    title: 'Runs, swims and squash on the calendar, next to your rides.',
    points: [
      "Click a day's number to plan a session of any sport, or log one you've done. Each week splits into Ride, Run, Swim and Other.",
      'Fitness, fatigue and form now count every sport. The power curve and FTP stay rides only.',
      "Turn on Completed activities in Settings → Integrations to bring in your Garmin's runs and swims from intervals.icu.",
      'Import planned runs and swims as text files, or paste one on the Run & swim tab of Workouts. The Format guide shows how.',
    ],
  },
  {
    version: '1.0.0',
    title: 'CrankHog 1.0: a training calendar and plans, and a ride clock that waits for you.',
    points: [
      'Calendar in the sidebar: put workouts on days, mark events and days off, and build a training plan for an event, with or without AI.',
      'The ride clock starts at your first pedal stroke, and Strava shows the same time as CrankHog. Write your own ride description in Settings → Strava & sync.',
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
