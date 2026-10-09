import { app, type BrowserWindow } from 'electron'

/**
 * CRANKHOG_SELFTEST=1: boot, round-trip one IPC call through the real preload,
 * print the result and exit. Used to smoke-test the *packaged* app, which
 * Playwright cannot drive (the hardening fuses disable --inspect).
 */
export function runSelfTestIfRequested(win: BrowserWindow): void {
  if (process.env.CRANKHOG_SELFTEST !== '1') return

  const fail = (why: string) => {
    process.stdout.write(`SELFTEST FAIL ${why}\n`)
    app.exit(1)
  }
  const timer = setTimeout(() => fail('timeout'), 20_000)

  win.webContents.once('did-finish-load', () => {
    win.webContents
      .executeJavaScript(
        // the updater's status shows whether this build can update itself (packaged, Developer ID signed)
        "Promise.all([window.crankhog.invoke('app.ping', { msg: 'selftest' }), window.crankhog.invoke('update.status', {})]).then(([r, update]) => JSON.stringify({ r, update, url: location.href }))",
      )
      .then((json: string) => {
        clearTimeout(timer)
        process.stdout.write(`SELFTEST OK ${json}\n`)
        app.exit(0)
      })
      .catch((e: unknown) => fail(String(e)))
  })
}
