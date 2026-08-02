/**
 * Local tangent-plane coordinate helpers for the lot visualizer.
 * Everything in the 3D scene is in METERS in a local frame at the lot
 * centroid: +x = east, +y = up, +z = south (so -z is "into the screen"
 * when looking north). Equirectangular approximation — accurate well
 * under a meter at subdivision scale.
 */

const D2R = Math.PI / 180
export const FT_TO_M = 0.3048

export interface LocalFrame {
  lat0: number
  lng0: number
  mPerDegLat: number
  mPerDegLng: number
  toLocal: (lat: number, lng: number) => [number, number]
}

export function makeFrame(lat0: number, lng0: number): LocalFrame {
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos(lat0 * D2R)
  return {
    lat0,
    lng0,
    mPerDegLat,
    mPerDegLng,
    toLocal(lat, lng) {
      const east = (lng - lng0) * mPerDegLng
      const south = -(lat - lat0) * mPerDegLat
      return [east, south]
    },
  }
}

export function pointInRingXZ(x: number, z: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]
    const [xj, zj] = ring[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function ringToLocal(ring: number[][], frame: LocalFrame): [number, number][] {
  const pts = ring.map(([lng, lat]) => frame.toLocal(lat, lng))
  if (pts.length > 1) {
    const [ax, az] = pts[0]
    const [bx, bz] = pts[pts.length - 1]
    if (Math.hypot(ax - bx, az - bz) < 1e-6) pts.pop()
  }
  return pts
}

export function ringCentroid(ring: [number, number][]): [number, number] {
  let x = 0, z = 0
  for (const [px, pz] of ring) { x += px; z += pz }
  return [x / ring.length, z / ring.length]
}

export function frontEdgeMidpoint(
  ring: [number, number][],
  facing: string | null
): [number, number] {
  const bearing: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  }
  const az = facing ? bearing[facing] ?? 180 : 180
  const dx = Math.sin(az * D2R)
  const dz = -Math.cos(az * D2R)
  let best: [number, number] = ring[0]
  let bestScore = -Infinity
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i]
    const [x2, z2] = ring[(i + 1) % ring.length]
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2
    const score = mx * dx + mz * dz
    if (score > bestScore) { bestScore = score; best = [mx, mz] }
  }
  return best
}

export function insetRing(ring: [number, number][], insetM: number): [number, number][] {
  const [cx, cz] = ringCentroid(ring)
  return ring.map(([x, z]) => {
    const dx = x - cx, dz = z - cz
    const len = Math.hypot(dx, dz) || 1
    const t = Math.max(0, 1 - insetM / len)
    return [cx + dx * t, cz + dz * t]
  })
}
