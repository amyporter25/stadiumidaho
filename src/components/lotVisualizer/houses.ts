import { getPlan } from '../../data/plans'
import { builderHomeMeta } from './builderHomes'

export {
  annotateBuilderHome,
  builderHomeMeta,
  findGarageDoor,
  loadBuilderHome,
  makeHomePlaceholder,
  PLAN_GLB_URL,
} from './builderHomes'

/** Plan footprint in meters — used by the lot-page visualizer pad. */
export function houseFootprint(planId: string): { wM: number; dM: number } {
  const meta = builderHomeMeta(planId)
  return { wM: meta.widthM, dM: meta.depthM }
}

/** Marketing cutout for picker cards / custom photo path — not the 3D house. */
export function planCutoutUrl(planId: string): string | null {
  return getPlan(planId)?.cutoutImg ?? null
}
