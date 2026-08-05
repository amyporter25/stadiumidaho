/**
 * Track B — Lot Studio world config.
 *
 * Stadium 3D TWO came from Polycam via Google Drive as a PlayCanvas-style
 * `.splat` (~31 MB, ~1.0M gaussians). Override at runtime with ?splat=<url>.
 */
export const STUDIO_WORLD = {
  /** Subdivision-wide drone Gaussian splat (Polycam “Stadium 3D TWO”). */
  splatUrl: '/splats/stadium-3d-two.splat',
  polycamCaptureId: '43c9aa3f-5f3a-46f1-8861-21db83675c09',
  polycamUrl: 'https://poly.cam/capture/43c9aa3f-5f3a-46f1-8861-21db83675c09',
  label: 'Stadium 3D TWO · site capture',
  /**
   * Bounds from the .splat centers (splat-local units):
   * size ≈ 18.4 × 21.9 × 21.8, center ≈ (-0.10, -3.86, -0.45)
   */
  cameraPosition: [-0.1, 6.8, 11.5] as [number, number, number],
  cameraLookAt: [-0.1, -3.9, -0.5] as [number, number, number],
  /** Default house width when a photo is first placed (feet). */
  defaultHouseWidthFt: 48,
  /**
   * Raycast plane near the bottom of the capture (terrain).
   * Nudge in the Align panel if cutouts float or sink.
   */
  groundY: -13.5,
  /**
   * Rough scale: site is ~20 units across; if that maps to ~800–1200 ft of
   * subdivision frontage, ~0.02 u/ft puts a 48 ft home at a readable size.
   */
  defaultUnitsPerFoot: 0.02,
}

export function resolveSplatUrl(search: string): string {
  const q = new URLSearchParams(search)
  const override = q.get('splat')
  if (override && /^https?:\/\//i.test(override)) return override
  if (override && override.startsWith('/')) return override
  return STUDIO_WORLD.splatUrl
}
