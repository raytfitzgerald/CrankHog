// The map services the journey map draws from: OpenFreeMap's vector tiles
// (free, no key, no request limits, commercial use allowed; credit OpenMapTiles
// and OpenStreetMap) and the AWS Terrain Tiles open dataset (Mapzen/Tilezen
// elevation, for hill shading and the 3D view). The renderer asks them; main's
// content security policy lets exactly these two hosts through and no others.

export const MAP_STYLE_BASE = 'https://tiles.openfreemap.org/styles'

/** Terrarium-encoded elevation, 256 px tiles to zoom 15. */
export const TERRAIN_TILES = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'
export const TERRAIN_MAX_ZOOM = 14
export const TERRAIN_ATTRIBUTION = '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen</a>'

export const MAP_TILE_ORIGINS = ['https://tiles.openfreemap.org', 'https://elevation-tiles-prod.s3.amazonaws.com'] as const
