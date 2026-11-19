// Ride with others (beta): the OpenBikeNet connection. It lives in main
// because the page may only talk to the app itself (CSP connect-src 'self'),
// and so the rider's display name and sharing choices are applied here, from
// the settings, whatever the page sends. The page says what it wants (a
// shared track to watch, the rider while riding it) and hears back who else
// is there. The protocol itself is src/core/openbikenet.
import { app, type BrowserWindow } from 'electron'
import { OBN_APP_ID } from '@core/openbikenet/protocol'
import { ObnSession, type ObnConfig } from '@core/openbikenet/session'
import { wsConnect } from '../group-ride/socket'
import type { AppSettings } from '@shared/settings'
import type { SettingsStore } from '../store/settings-store'
import { emit, handle } from './register'

/** How often the session runs its clock: updates, pings, reconnects. */
const TICK_MS = 250
/** The page hears about changes at most this often. */
const EMIT_EVERY_MS = 250
const configOf = (s: AppSettings): ObnConfig => ({ ...s.groupRides })

export function registerGroupRideHandlers(o: { settings: SettingsStore; window: () => BrowserWindow | null }): { pageReset: () => void } {
  const session = new ObnSession({
    connect: wsConnect(`CrankHog/${app.getVersion()}`),
    app: { id: OBN_APP_ID, version: app.getVersion(), name: 'CrankHog', url: 'https://crankhog.app' },
    now: Date.now,
  })
  session.configure(configOf(o.settings.get()))
  o.settings.onChange((s) => session.configure(configOf(s)))

  let emitted = -1
  let emittedAt = 0
  const timer = setInterval(() => {
    session.tick()
    const now = Date.now()
    if (session.version === emitted || now - emittedAt < EMIT_EVERY_MS) return
    const w = o.window()
    if (!w) return
    emitted = session.version
    emittedAt = now
    emit(w.webContents, 'groupRide.state', session.state())
  }, TICK_MS)
  timer.unref()

  handle('groupRide.set', (req) => {
    session.want(req)
    return session.state()
  })
  handle('groupRide.status', () => session.state())

  // leave the track before the app goes, rather than timing out on the server
  app.on('before-quit', () => {
    clearInterval(timer)
    session.dispose()
  })

  return {
    // a page that crashed or reloaded has no ride any more: off the track, and nothing watched
    pageReset: () => session.want({ watch: null, rider: null, simulated: false }),
  }
}
