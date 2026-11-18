// The CrankHog add-on for Claude Desktop: an MCP bundle (.mcpb), which is a
// zip of manifest.json, the add-on script and an icon. Claude Desktop runs it
// with its own Node, so the rider needs nothing installed. It's built for
// this Mac when the rider asks (it names this profile's folder), and opening
// it hands it to Claude Desktop's installer.
//
// The manifest follows MCPB manifest_version 0.3
// (github.com/modelcontextprotocol/mcpb, MANIFEST.md), whose schema refuses
// any key it doesn't know.
import { readFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'

export interface AddonInput {
  /** The app's version, as the add-on's. */
  version: string
  /** The folder the add-on reads mcp.json from. */
  dir: string
  script: Uint8Array
  icon: Uint8Array | null
}

export function addonManifest(o: { version: string; dir: string; icon: boolean }): Record<string, unknown> {
  return {
    manifest_version: '0.3',
    name: 'crankhog',
    display_name: 'CrankHog',
    version: o.version,
    description: 'Your CrankHog training in Claude: read it, change the calendar, and build plans together.',
    long_description:
      'Claude reads what CrankHog knows about your training (never your name or Strava data), changes your calendar, workouts, days off, events and thresholds, and saves training plans you agree on. Claude asks before each change, and every change can be undone in CrankHog. CrankHog has to be open on this Mac; Claude opens it when it needs it.',
    author: { name: 'Ray Fitzgerald', url: 'https://github.com/raytfitzgerald' },
    homepage: 'https://crankhog.app',
    ...(o.icon ? { icon: 'icon.png' } : {}),
    server: {
      type: 'node',
      entry_point: 'server/crankhog-mcp.mjs',
      mcp_config: { command: 'node', args: ['${__dirname}/server/crankhog-mcp.mjs', '--dir', o.dir] },
    },
    tools_generated: true,
    license: 'MIT',
    compatibility: { platforms: ['darwin'], runtimes: { node: '>=18.0.0' } },
  }
}

/** The add-on as .mcpb bytes. */
export function buildAddon(o: AddonInput): Uint8Array {
  const manifest = addonManifest({ version: o.version, dir: o.dir, icon: o.icon !== null })
  return zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'server/crankhog-mcp.mjs': o.script,
    ...(o.icon ? { 'icon.png': o.icon } : {}),
  })
}

/** Reads a file, or null if it isn't there. */
export function readOptional(path: string): Uint8Array | null {
  try {
    return new Uint8Array(readFileSync(path))
  } catch {
    return null
  }
}
