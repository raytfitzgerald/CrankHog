// The iPhone app's Info.plist must explain every protected resource the web
// layer can reach, or iOS kills the app the moment it's touched. App Review
// found the first one: "Add a photo" offers Take Photo, which opens the camera.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const plistPath = join(import.meta.dirname, '../../ios/App/App/Info.plist')

/** The plist as JSON (plutil on macOS), or a plain-text fallback elsewhere. */
function keys(): Record<string, unknown> | string {
  try {
    return JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', plistPath], { encoding: 'utf8' })) as Record<string, unknown>
  } catch {
    return readFileSync(plistPath, 'utf8')
  }
}

describe('iOS Info.plist', () => {
  it.each(['NSBluetoothAlwaysUsageDescription', 'NSCameraUsageDescription'])('explains %s', (key) => {
    const p = keys()
    if (typeof p === 'string') expect(p).toContain(`<key>${key}</key>`)
    else expect(String(p[key] ?? '').length).toBeGreaterThan(20)
  })
})
