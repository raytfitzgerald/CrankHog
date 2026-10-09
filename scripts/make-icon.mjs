// Renders the app icon and the brand mark: a velodrome seen from above, its
// boards white, its lines in order from the inside out (the côte d'azur band,
// the black measurement line, the sprinters' red, the stayers' blue), a rider
// on the far bend, on a Stayer Blue tile. Writes build/icon.svg (the source),
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

const C = { stayer: '#1e59cd', sprinter: '#e0383b', azure: '#77c3ff', night: '#111d36', boards: '#f4f8fc', infield: '#1846ab', hog: '#e9a2ab', hogShade: '#c8818d', tusk: '#f4f1e6' }

// Sir Loin, on the bend. A plainer cut of the head in
// src/renderer/src/brand/hog/HogHead.tsx: no cap, no eye highlight, nothing
// that would turn to mush at 16 px. Drawn round (0, 0) at radius 12, facing
// +x, so `s` scales him to the track.
function hog(x, y, s, rot) {
  // stroke widths are given in icon pixels, so dividing by the scale keeps
  // them the same weight as the track's lines however big he is drawn
  const p = (d, fill, px) => `<path d="${d}" fill="${fill}" stroke="${C.night}" stroke-width="${f(px / s)}" stroke-linejoin="round"/>`
  return [
    `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${f(s)})">`,
    p('M-5.4 -9.6 L-12.8 -11.4 Q-12.8 -4.8 -7.4 -3.6 Q-4.8 -5.2 -5.4 -9.6 Z', C.hogShade, 8),
    p(
      'M-11 -2 C-11 -8 -7.2 -11.2 -2.4 -11.2 C1.4 -11.2 3.8 -9 4.6 -6 C5.2 -3.6 6.2 -1.8 8 -1.1 L9.6 -0.3 A3.6 3.6 0 0 1 9.6 6.3 L7.6 6.7 C6.6 8.5 4.2 9.9 -0.4 10 C-6.6 10.1 -11 6.2 -11 -2 Z',
      C.hog,
      9,
    ),
    `<ellipse cx="10.2" cy="3" rx="1.5" ry="2.5" fill="${C.hogShade}" stroke="${C.night}" stroke-width="${f(7 / s)}"/>`,
    `<circle cx="-0.4" cy="-2.6" r="1.7" fill="${C.night}"/>`,
    p('M4.2 6.8 L6.2 5.8 Q7.6 2.6 7.2 -1.2 Q5.4 2.6 4.2 6.8 Z', C.tusk, 6),
    p('M6 6.8 L8.6 5.4 Q10.4 1.4 9.8 -3.6 Q7.2 1.2 6 6.8 Z', C.tusk, 7),
    '</g>',
  ].join('')
}
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
  // Sir Loin, along the top straight, where he reads at 16 px. On the bend he
  // has to be rotated, and the tusks turn into a smudge.
  const rider = [cx + L * 0.42, cy - r]
  return [
    `<path d="${stadium(inner + 1)}" fill="${C.infield}"/>`,
    `<path d="${stadium(r)}" fill="none" stroke="${C.boards}" stroke-width="${RING}"/>`,
    ...lanes.map(([rad, w, col]) => `<path d="${stadium(rad)}" fill="none" stroke="${col}" stroke-width="${w}"/>`),
    hog(rider[0], rider[1], 6.6, 0),
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
