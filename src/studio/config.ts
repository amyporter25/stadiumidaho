import { assetUrl } from '../lib/assetUrl'

/**
 * Track B — Lot Studio config.
 *
 * Primary experience is lot-first: aerial photo + plat outline + house photo.
 * The Polycam splat is kept only as an optional experiment (?world=splat) —
 * site-wide drone splats of bare dirt rarely read as real lots in a browser.
 */
export const STUDIO_WORLD = {
  defaultLotName: '46/3',
  label: 'Lot Studio',
  defaultHouseWidthFt: 48,
  /** Optional experimental splat (not the default). */
  splatUrl: assetUrl('/splats/stadium-3d-two.splat'),
  polycamUrl: 'https://poly.cam/capture/43c9aa3f-5f3a-46f1-8861-21db83675c09',
}

export type StudioWorldMode = 'lot' | 'splat'

export function resolveWorldMode(search: string): StudioWorldMode {
  const q = new URLSearchParams(search)
  return q.get('world') === 'splat' ? 'splat' : 'lot'
}

export function resolveLotName(search: string): string {
  const q = new URLSearchParams(search)
  return q.get('lot') || STUDIO_WORLD.defaultLotName
}
