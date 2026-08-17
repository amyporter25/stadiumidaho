/**
 * Rough ballpark costs for driveway + landscaping overlays in Lot Studio.
 * These are visualization aids for buyers — not bids. Rates are mid-range
 * Treasure Valley residential estimates and should be confirmed with the builder.
 */

export type DrivewayMaterial = 'concrete' | 'asphalt'

export const DRIVEWAY_DEFAULTS = {
  /** Typical residential driveway width */
  widthFt: 14,
  concretePerSqFtUsd: 10,
  asphaltPerSqFtUsd: 6,
}

export interface DrivewayEstimate {
  lengthFt: number
  widthFt: number
  areaSqFt: number
  material: DrivewayMaterial
  costUsd: number
}

export function estimateDriveway(
  lengthM: number,
  material: DrivewayMaterial = 'concrete',
  widthFt = DRIVEWAY_DEFAULTS.widthFt
): DrivewayEstimate {
  const lengthFt = Math.max(0, lengthM / 0.3048)
  const areaSqFt = lengthFt * widthFt
  const rate =
    material === 'concrete'
      ? DRIVEWAY_DEFAULTS.concretePerSqFtUsd
      : DRIVEWAY_DEFAULTS.asphaltPerSqFtUsd
  return {
    lengthFt,
    widthFt,
    areaSqFt,
    material,
    costUsd: Math.round(areaSqFt * rate),
  }
}

export type PlantKind = 'tree' | 'evergreen' | 'shrub' | 'lawn'

/** Installed plant / patch ballparks used for the landscaping tally. */
export const PLANT_COST_USD: Record<PlantKind, number> = {
  tree: 450,
  evergreen: 380,
  shrub: 85,
  /** Per lawn patch (~12×12 ft starter sod) */
  lawn: 180,
}

export const PLANT_LABELS: Record<PlantKind, string> = {
  tree: 'Shade tree',
  evergreen: 'Evergreen',
  shrub: 'Shrub',
  lawn: 'Lawn patch',
}

export function formatUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}
