import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { assetUrl } from '../../lib/assetUrl'
import { getPlan, type GarageEntry } from '../../data/plans'
import { FT_TO_M } from './geo'

/**
 * Load a vendor builder-home GLB onto a lot.
 *
 * Studio does not build houses in-engine. Drop a modeled `.glb` in
 * `public/plans/glb/` (see `docs/builder-home-glb-brief.md`). Until that
 * file exists, we seat a footprint placeholder so the lot, driveway, and
 * camera still work.
 *
 * Convention: meters, Y-up, origin = footprint center at ground, street
 * facade faces −Z. Street camera looks toward +Z, so viewer-left = local +X.
 */

export const PLAN_GLB_URL: Record<string, string> = {
  'whitestone-front': assetUrl('/plans/glb/whitestone-front.glb'),
  whitestone: assetUrl('/plans/glb/whitestone-front.glb'),
  'whitestone-side': assetUrl('/plans/glb/whitestone-side.glb'),
  brownstone: assetUrl('/plans/glb/brownstone.glb'),
}

export interface BuilderHomeMeta {
  widthM: number
  depthM: number
  garageEntry: GarageEntry
  glbUrl: string | null
}

export interface LoadedBuilderHome {
  house: THREE.Group
  fromGlb: boolean
}

export function builderHomeMeta(planId: string): BuilderHomeMeta {
  const catalogId = planId === 'whitestone' ? 'whitestone-front' : planId
  const plan = getPlan(catalogId)
  return {
    widthM: (plan?.footprintFt.width ?? 94) * FT_TO_M,
    depthM: (plan?.footprintFt.depth ?? 58) * FT_TO_M,
    garageEntry: plan?.garageEntry ?? 'front',
    glbUrl: PLAN_GLB_URL[planId] ?? PLAN_GLB_URL[catalogId] ?? null,
  }
}

/** Named garage threshold, matching the vendor brief. */
export function findGarageDoor(
  house: THREE.Object3D,
  garageEntry: GarageEntry
): THREE.Object3D | null {
  if (garageEntry === 'side') {
    return (
      house.getObjectByName('GarageDoorSide') ||
      house.getObjectByName('GarageDoorFront') ||
      house.getObjectByName('massingGarageDoor') ||
      null
    )
  }
  return (
    house.getObjectByName('GarageDoorFront') ||
    house.getObjectByName('massingGarageDoor') ||
    null
  )
}

/**
 * Stamp footprint + garage attach points onto the root so Studio can scale
 * the house and aim the driveway without knowing the mesh internals.
 */
export function annotateBuilderHome(house: THREE.Group, planId: string, fromGlb: boolean): void {
  const meta = builderHomeMeta(planId)
  const catalogId = planId === 'whitestone' ? 'whitestone-front' : planId
  const plan = getPlan(catalogId)

  house.updateMatrixWorld(true)
  house.name = `builderHome:${planId}`
  house.userData.planId = planId
  house.userData.widthM = meta.widthM
  house.userData.depthM = meta.depthM
  house.userData.garageEntry = meta.garageEntry
  house.userData.glbReady = fromGlb

  const size = new THREE.Box3().setFromObject(house).getSize(new THREE.Vector3())
  house.userData.facadeHeightM = size.y > 0.1 ? size.y : 8

  const door = findGarageDoor(house, meta.garageEntry)
  if (door) {
    const local = house.worldToLocal(door.getWorldPosition(new THREE.Vector3()))
    house.userData.garageLocalX = local.x
    house.userData.garageLocalZ = local.z
    return
  }

  // No named node yet — aim at the catalog garage fraction so the driveway
  // still meets the wing instead of the front door.
  const frac = plan?.garageXFrac ?? 0
  // garageXFrac is elevation-left/right; local +X is viewer-left (see file header).
  const localX = -frac * meta.widthM
  if (meta.garageEntry === 'side') {
    house.userData.garageLocalX = Math.sign(localX || 1) * (meta.widthM / 2)
    house.userData.garageLocalZ = 0
  } else {
    house.userData.garageLocalX = localX
    house.userData.garageLocalZ = -meta.depthM / 2
  }
}

/** Footprint box only — not a second procedural house. */
export function makeHomePlaceholder(planId: string): THREE.Group {
  const meta = builderHomeMeta(planId)
  const house = new THREE.Group()
  const wallM = 3.2

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(meta.widthM, wallM, meta.depthM),
    new THREE.MeshStandardMaterial({
      color: 0xc9c4b8,
      roughness: 0.92,
      metalness: 0.02,
    })
  )
  body.position.y = wallM / 2
  body.castShadow = true
  body.receiveShadow = true
  house.add(body)

  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(meta.widthM, meta.depthM),
    new THREE.MeshBasicMaterial({
      color: 0xf2b04a,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    })
  )
  pad.name = 'footprintPad'
  pad.rotation.x = -Math.PI / 2
  pad.position.y = 0.02
  house.add(pad)

  annotateBuilderHome(house, planId, false)
  return house
}

let sharedLoader: GLTFLoader | null = null

function gltfLoader(): GLTFLoader {
  if (!sharedLoader) sharedLoader = new GLTFLoader()
  return sharedLoader
}

export function loadBuilderHome(planId: string): Promise<LoadedBuilderHome> {
  const url = builderHomeMeta(planId).glbUrl
  if (!url) {
    return Promise.resolve({ house: makeHomePlaceholder(planId), fromGlb: false })
  }

  return new Promise((resolve) => {
    gltfLoader().load(
      url,
      (gltf) => {
        const house = new THREE.Group()
        house.add(gltf.scene)
        annotateBuilderHome(house, planId, true)
        resolve({ house, fromGlb: true })
      },
      undefined,
      () => resolve({ house: makeHomePlaceholder(planId), fromGlb: false })
    )
  })
}
