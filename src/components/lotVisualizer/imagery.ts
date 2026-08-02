import * as THREE from 'three'

/**
 * Drapes real aerial photography over the terrain mesh.
 *
 * Tiles come from Esri World Imagery (Maxar etc.) — free for low-volume use
 * with attribution, CORS-enabled. We stitch the XYZ tiles covering the lot's
 * elevation grid into one canvas and return it as a texture plus the exact
 * lat/lng box the stitched image covers (tiles snap to fixed boundaries, so
 * it's slightly larger than the grid). Web Mercator math — matches the
 * grid's lat/lng coordinates to sub-meter accuracy at this scale.
 */

export interface BBox {
  south: number
  west: number
  north: number
  east: number
}

export interface AerialTexture {
  texture: THREE.CanvasTexture
  /** exact bounds of the stitched image (Web Mercator tile edges) */
  bbox: BBox
}

const TILE = 256
const D2R = Math.PI / 180

function mercY(lat: number): number {
  const r = lat * D2R
  return Math.log(Math.tan(Math.PI / 4 + r / 2))
}

function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

function latToTileY(lat: number, z: number): number {
  return Math.floor(((1 - mercY(lat) / Math.PI) / 2) * 2 ** z)
}

function tileXToLng(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180
}

function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z
  return Math.atan(Math.sinh(n)) / D2R
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function loadAerialTexture(bbox: BBox): Promise<AerialTexture | null> {
  // pick the highest zoom whose tile count stays sane — at eye level the
  // ground fills the screen, so allow up to ~100 tiles (~1.5 MB, one-time)
  for (let z = 19; z >= 14; z--) {
    const x0 = lngToTileX(bbox.west, z)
    const x1 = lngToTileX(bbox.east, z)
    const y0 = latToTileY(bbox.north, z)
    const y1 = latToTileY(bbox.south, z)
    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    if (w * h > 100) continue

    const canvas = document.createElement('canvas')
    canvas.width = w * TILE
    canvas.height = h * TILE
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const jobs: Promise<void>[] = []
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        jobs.push(
          loadTile(
            `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
          ).then((img) => {
            if (img) ctx.drawImage(img, (x - x0) * TILE, (y - y0) * TILE)
          })
        )
      }
    }
    await Promise.all(jobs)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8 // keep it sharp at eye-level grazing angles
    return {
      texture,
      bbox: {
        west: tileXToLng(x0, z),
        east: tileXToLng(x1 + 1, z),
        north: tileYToLat(y0, z),
        south: tileYToLat(y1 + 1, z),
      },
    }
  }
  return null
}

/** Mercator-accurate UV for a lat/lng point inside the stitched image. */
export function aerialUV(lat: number, lng: number, bbox: BBox): [number, number] {
  const u = (lng - bbox.west) / (bbox.east - bbox.west)
  const v = (mercY(lat) - mercY(bbox.south)) / (mercY(bbox.north) - mercY(bbox.south))
  return [u, v]
}
