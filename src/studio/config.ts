/**
 * Track B — Lot Studio world config.
 *
 * The Polycam share link alone cannot be loaded in-app (no public splat download
 * API). Point `splatUrl` at a web-sized .ksplat / .splat hosted locally or on a CDN.
 * Override at runtime with ?splat=<url>.
 */
export const STUDIO_WORLD = {
  /** Existing compressed site capture — stand-in until Stadium 3D TWO is converted. */
  splatUrl: '/splats/stadium.ksplat',
  /** Owner's subdivision-wide drone splat on Polycam (source of truth for capture). */
  polycamCaptureId: '43c9aa3f-5f3a-46f1-8861-21db83675c09',
  polycamUrl: 'https://poly.cam/capture/43c9aa3f-5f3a-46f1-8861-21db83675c09',
  label: 'The Stadium — site capture',
  /** Initial orbit camera (splat-local units; site capture is roughly unit-scale). */
  cameraPosition: [0, 2.4, 4.2] as [number, number, number],
  cameraLookAt: [0, -0.2, 0] as [number, number, number],
  /** Default house width when a photo is first placed (feet). */
  defaultHouseWidthFt: 48,
  /** Invisible raycast plane height in splat space. */
  groundY: -0.35,
}

export function resolveSplatUrl(search: string): string {
  const q = new URLSearchParams(search)
  const override = q.get('splat')
  if (override && /^https?:\/\//i.test(override)) return override
  if (override && override.startsWith('/')) return override
  return STUDIO_WORLD.splatUrl
}
