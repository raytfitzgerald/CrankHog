// Renders the app icon and the brand mark: a velodrome seen from above, its
// boards white, its lines in order from the inside out (the côte d'azur band,
// the black measurement line, the sprinters' red, the stayers' blue), on a
// Stayer Blue tile. The track carries the mark on its own; Sir Loin lives in
// the app, not on the icon. Writes build/icon.svg (the source),
// build/icon.png (1024 px, used by electron-builder) and the mark and icon
// under docs/brand/, and the iPhone app's icon (full bleed and opaque, since
// iOS rounds the corners itself) into ios/. Colours: src/shared/brand.ts;
// guidelines: docs/BRAND.md.
// Run: npx electron scripts/make-icon.mjs
import { app, BrowserWindow } from 'electron'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const C = { stayer: '#1e59cd', sprinter: '#e0383b', azure: '#77c3ff', night: '#111d36', boards: '#f4f8fc', infield: '#1846ab' }

const S = 1024
const cx = 512
const cy = 512
// the track's outer size, and the width of its boards
const W = 660
const H = 404
const RING = 104
const r = H / 2 - RING / 2 // the boards' centreline radius at the bends
const L = (W - H) / 2 // half a straight

const f = (v) => Number(v.toFixed(1))
const stadium = (rad) =>
  `M${f(cx - L)} ${f(cy - rad)} L${f(cx + L)} ${f(cy - rad)} A${f(rad)} ${f(rad)} 0 0 1 ${f(cx + L)} ${f(cy + rad)} L${f(cx - L)} ${f(cy + rad)} A${f(rad)} ${f(rad)} 0 0 1 ${f(cx - L)} ${f(cy - rad)} Z`

function body() {
  const inner = r - RING / 2
  const lanes = [
    [inner + 16, 20, C.azure],
    [inner + 38, 6, C.night],
    [inner + 58, 9, C.sprinter],
    [inner + 84, 9, C.stayer],
  ]
  return [
    `<path d="${stadium(inner + 1)}" fill="${C.infield}"/>`,
    `<path d="${stadium(r)}" fill="none" stroke="${C.boards}" stroke-width="${RING}"/>`,
    ...lanes.map(([rad, w, col]) => `<path d="${stadium(rad)}" fill="none" stroke="${col}" stroke-width="${w}"/>`),
  ]
}

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="CrankHog">
  <rect x="100" y="100" width="824" height="824" rx="186" fill="${C.stayer}"/>
  <rect x="101.5" y="101.5" width="821" height="821" rx="184.5" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="3"/>
  ${body().join('\n  ')}
</svg>
`
// iOS: the same tile edge to edge, the track scaled to sit on it as it does on the Mac icon's tile
const iosIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="CrankHog">
  <rect width="${S}" height="${S}" fill="${C.stayer}"/>
  <g transform="translate(${cx} ${cy}) scale(${f(S / 824)}) translate(${-cx} ${-cy})">
  ${body().join('\n  ')}
  </g>
</svg>
`
const pad = 24
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx - W / 2 - pad} ${cy - H / 2 - pad} ${W + 2 * pad} ${H + 2 * pad}" role="img" aria-label="CrankHog">
  ${body().join('\n  ')}
</svg>
`

const root = join(import.meta.dirname, '..')
writeFileSync(join(root, 'build', 'icon.svg'), icon)
writeFileSync(join(root, 'docs', 'brand', 'crankhog-icon.svg'), icon)
writeFileSync(join(root, 'docs', 'brand', 'crankhog-mark.svg'), mark)

async function render(svg) {
  const win = new BrowserWindow({ width: S, height: S, show: false, frame: false, transparent: true, backgroundColor: '#00000000', useContentSize: true, webPreferences: { offscreen: true } })
  const html = `<!doctype html><html style="background:transparent"><body style="margin:0;overflow:hidden;background:transparent"><img style="display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${S}" height="${S}"></body></html>`
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await new Promise((res) => setTimeout(res, 300))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: S, height: S })
  win.destroy()
  return img.resize({ width: S, height: S })
}

// one window per render: closing one must not end the script before the next
app.on('window-all-closed', () => undefined)

app.whenReady().then(async () => {
  const img = await render(icon)
  writeFileSync(join(root, 'build', 'icon.png'), img.toPNG())
  // App Store icons may not have an alpha channel: a JPEG round trip drops it (the tile is opaque anyway)
  const ios = join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png')
  const tmp = join(tmpdir(), 'crankhog-ios-icon.jpg')
  writeFileSync(tmp, (await render(iosIcon)).toJPEG(100))
  execFileSync('sips', ['-s', 'format', 'png', tmp, '--out', ios], { stdio: 'ignore' })
  // The phone web app's icons, from the same drawing, so they never drift.
  const web = join(root, 'src', 'renderer', 'web-public', 'icons')
  for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
    writeFileSync(join(web, name), img.resize({ width: size, height: size, quality: 'best' }).toPNG())
  }
  console.log('wrote build/icon.svg, build/icon.png, docs/brand/, the iOS app icon and the web icons', img.getSize())
  app.quit()
})
