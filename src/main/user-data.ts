// Carrying a rider's data across the FreeGaz → CrankHog rename (0.6.0).
//
// `productName` decides Electron's userData folder, and every ride lives in
// there: the IndexedDB database, the journal, settings and the secret store.
// Renaming the app would otherwise point a 0.6.0 install at an empty
// Application Support/CrankHog and look exactly like total data loss.
//
// So on the first 0.6.0 launch we rename the folder rather than make a new
// one. The `app://freegaz` origin inside it deliberately does NOT change
// (see app-protocol.ts), so IndexedDB is still keyed the way it was and the
// rides come back untouched.
//
// This must run before anything reads `app.getPath('userData')`.

import { existsSync, renameSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export const OLD_NAME = 'FreeGaz'
export const NEW_NAME = 'CrankHog'

export type MigrationOutcome =
  | { moved: false; reason: 'already-migrated' | 'nothing-to-move' | 'both-exist' }
  | { moved: true; from: string; to: string }
  | { moved: false; reason: 'failed'; error: string }

/**
 * Renames `<parent>/FreeGaz` to `<parent>/CrankHog`, once.
 *
 * It refuses when the new folder already exists: that means either the rename
 * has happened or the rider has run both versions, and in both cases merging
 * two profiles is far worse than leaving them alone. A failure is reported,
 * never thrown — an app that won't start is worse than one that starts empty,
 * and the old folder is still there to recover from by hand.
 */
export function migrateDir(parent: string, oldName = OLD_NAME, newName = NEW_NAME): MigrationOutcome {
  const from = join(parent, oldName)
  const to = join(parent, newName)
  if (existsSync(to)) return { moved: false, reason: existsSync(from) ? 'both-exist' : 'already-migrated' }
  if (!existsSync(from)) return { moved: false, reason: 'nothing-to-move' }
  try {
    renameSync(from, to)
    return { moved: true, from, to }
  } catch (e) {
    return { moved: false, reason: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Both folders the rename touches: the profile in Application Support, and the
 * rider's own Documents/FreeGaz, where exported FIT files live.
 *
 * `userData` is the path Electron would use *now* (…/CrankHog), so the folder
 * to look for is its sibling under the old name.
 */
export function migrateFromFreeGaz(paths: { userData: string; documents: string }): Record<'profile' | 'rides', MigrationOutcome> {
  return {
    // only rename a folder Electron named after the app, not a custom --user-data-dir
    profile: basename(paths.userData) === NEW_NAME ? migrateDir(dirname(paths.userData)) : { moved: false, reason: 'nothing-to-move' },
    rides: migrateDir(paths.documents),
  }
}
