import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { addonManifest, buildAddon } from './addon'

const DIR = '/Users/me/Library/Application Support/CrankHog/mcp'

describe('the Claude Desktop add-on', () => {
  it("is a zip of the manifest, the script and the icon, pointed at this profile's folder", () => {
    const files = unzipSync(buildAddon({ version: '1.4.0', dir: DIR, script: new TextEncoder().encode('// add-on'), icon: new Uint8Array([137, 80, 78, 71]) }))
    expect(Object.keys(files).sort()).toEqual(['icon.png', 'manifest.json', 'server/crankhog-mcp.mjs'])
    expect(strFromU8(files['server/crankhog-mcp.mjs']!)).toBe('// add-on')
    const m = JSON.parse(strFromU8(files['manifest.json']!)) as ReturnType<typeof addonManifest>
    expect(m).toMatchObject({
      manifest_version: '0.3',
      name: 'crankhog',
      version: '1.4.0',
      icon: 'icon.png',
      server: { type: 'node', entry_point: 'server/crankhog-mcp.mjs', mcp_config: { command: 'node', args: ['${__dirname}/server/crankhog-mcp.mjs', '--dir', DIR] } },
      compatibility: { platforms: ['darwin'] },
    })
  })

  it('leaves the icon out when there is none', () => {
    const files = unzipSync(buildAddon({ version: '1.4.0', dir: DIR, script: new Uint8Array(), icon: null }))
    expect(Object.keys(files)).not.toContain('icon.png')
    expect(JSON.parse(strFromU8(files['manifest.json']!))).not.toHaveProperty('icon')
  })

  it('uses only keys the MCPB 0.3 schema knows (it refuses any other)', () => {
    const known = ['manifest_version', 'name', 'display_name', 'version', 'description', 'long_description', 'author', 'homepage', 'icon', 'server', 'tools_generated', 'license', 'compatibility']
    for (const k of Object.keys(addonManifest({ version: '1.0.0', dir: DIR, icon: true }))) expect(known).toContain(k)
  })
})
