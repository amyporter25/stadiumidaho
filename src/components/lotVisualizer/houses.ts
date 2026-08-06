import * as THREE from 'three'
import { FT_TO_M } from './geo'

/**
 * Simplified-but-recognizable 3D massing for each Blackstone plan, built
 * from the footprint dimensions and the elevation sheets. The goal is not
 * photorealism — it's that a buyer standing on the street can read
 * "that's the Brownstone": right scale, right roofline, garage where the
 * garage is, porch where the porch is.
 *
 * Each model is a THREE.Group whose origin is the center of the footprint
 * at ground level, with the FRONT of the house facing -z (so rotation 0
 * puts the front toward the street when the street is north of the lot;
 * we rotate per-lot to face the actual road).
 */

type GarageEntry = 'front' | 'side'

interface HouseSpec {
  widthFt: number
  depthFt: number
  wallM: number // wall height
  roofRiseM: number // ridge height above walls
  /** Garage wing side when looking at the front */
  garageWing: 'right' | 'left' | 'none'
  garageEntry: GarageEntry
  garageWidthFrac: number // fraction of total width
  garageHeightM: number
  porchDepthM: number
  siding: number
  roof: number
  trim: number
  stone?: number
}

const SPECS: Record<string, HouseSpec> = {
  brownstone: {
    widthFt: 91,
    depthFt: 72,
    wallM: 3.4,
    roofRiseM: 2.6,
    garageWing: 'left',
    garageEntry: 'front',
    garageWidthFrac: 0.4,
    garageHeightM: 4.6,
    porchDepthM: 4.0,
    siding: 0xd8d2c4,
    roof: 0x6b6357,
    trim: 0xb59a6d,
    stone: 0x8a8070,
  },
  // Front-facing Whitestone (whitestone-7-2-rwr.pdf)
  'whitestone-front': {
    widthFt: 94,
    depthFt: 70,
    wallM: 3.2,
    roofRiseM: 2.9,
    garageWing: 'left',
    garageEntry: 'front',
    garageWidthFrac: 0.42,
    garageHeightM: 4.6,
    porchDepthM: 3.0,
    siding: 0xe9e6dd,
    roof: 0x30302f,
    trim: 0x9c7b52,
  },
  // Side-entry Whitestone (whitestone-29-3-pse.pdf)
  'whitestone-side': {
    widthFt: 94,
    depthFt: 78,
    wallM: 3.2,
    roofRiseM: 2.9,
    garageWing: 'left',
    garageEntry: 'side',
    garageWidthFrac: 0.4,
    garageHeightM: 4.6,
    porchDepthM: 3.0,
    siding: 0xe9e6dd,
    roof: 0x30302f,
    trim: 0x9c7b52,
  },
  // Legacy alias used by older LotVisualizer state
  whitestone: {
    widthFt: 94,
    depthFt: 70,
    wallM: 3.2,
    roofRiseM: 2.9,
    garageWing: 'left',
    garageEntry: 'front',
    garageWidthFrac: 0.42,
    garageHeightM: 4.6,
    porchDepthM: 3.0,
    siding: 0xe9e6dd,
    roof: 0x30302f,
    trim: 0x9c7b52,
  },
  sunstone: {
    widthFt: 104,
    depthFt: 72,
    wallM: 3.3,
    roofRiseM: 2.7,
    garageWing: 'right',
    garageEntry: 'front',
    garageWidthFrac: 0.44,
    garageHeightM: 4.6,
    porchDepthM: 3.2,
    siding: 0xded8cc,
    roof: 0x55504a,
    trim: 0x8a6a48,
  },
}

function mat(color: number, roughness = 0.9): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 })
}

/** a gabled box: rectangular walls + triangular prism roof, ridge along x */
function gabledBlock(
  w: number,
  d: number,
  wallH: number,
  roofRise: number,
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  overhang = 0.4
): THREE.Group {
  const g = new THREE.Group()

  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat)
  walls.position.y = wallH / 2
  walls.castShadow = true
  walls.receiveShadow = true
  g.add(walls)

  const hw = w / 2 + overhang
  const shape = new THREE.Shape()
  shape.moveTo(-hw, 0)
  shape.lineTo(hw, 0)
  shape.lineTo(0, roofRise)
  shape.closePath()
  const roofGeo = new THREE.ExtrudeGeometry(shape, {
    depth: d + overhang * 2,
    bevelEnabled: false,
  })
  roofGeo.translate(0, 0, -(d + overhang * 2) / 2)
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.y = wallH
  roof.castShadow = true
  roof.receiveShadow = true
  g.add(roof)

  return g
}

/** gabled block with ridge running front-to-back (z) — for the main house */
function gabledBlockZ(
  w: number,
  d: number,
  wallH: number,
  roofRise: number,
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  overhang = 0.4
): THREE.Group {
  const g = gabledBlock(d, w, wallH, roofRise, wallMat, roofMat, overhang)
  g.rotation.y = Math.PI / 2
  return g
}

function resolveSpec(planId: string): HouseSpec {
  return SPECS[planId] ?? SPECS.brownstone
}

export function buildHouse(planId: string): THREE.Group {
  const spec = resolveSpec(planId)
  const W = spec.widthFt * FT_TO_M
  const D = spec.depthFt * FT_TO_M

  const siding = mat(spec.siding)
  const roof = mat(spec.roof, 0.95)
  const trim = mat(spec.trim, 0.8)
  const doorMat = mat(0x3a3530, 0.85)
  const glass = new THREE.MeshStandardMaterial({
    color: 0x2a3540,
    roughness: 0.2,
    metalness: 0.6,
  })

  const house = new THREE.Group()
  house.name = `house-${planId}`

  const garageW = W * spec.garageWidthFrac
  const mainW = W - garageW
  const garageOnLeft = spec.garageWing === 'left'
  const mainX = garageOnLeft ? -W / 2 + garageW + mainW / 2 : -W / 2 + mainW / 2
  const garageX = garageOnLeft ? -W / 2 + garageW / 2 : W / 2 - garageW / 2

  // Main living block
  const main = gabledBlockZ(mainW, D * 0.92, spec.wallM, spec.roofRiseM, siding, roof)
  main.position.set(mainX, 0, D * 0.02)
  house.add(main)

  if (spec.garageWing !== 'none') {
    const garageDepth = D * (spec.garageEntry === 'side' ? 0.88 : 0.8)
    const garage = gabledBlock(
      garageW,
      garageDepth,
      spec.garageHeightM,
      spec.roofRiseM * 0.85,
      siding,
      roof
    )
    garage.position.set(garageX, 0, -D * 0.02)
    house.add(garage)

    const garageFrontZ = -D * 0.02 - garageDepth / 2 - 0.06

    if (spec.garageEntry === 'front') {
      // Tall RV bay door + wider double door, both facing the street
      const rvW = garageW * 0.38
      const dblW = garageW * 0.48
      const doorH = spec.garageHeightM * 0.72
      const rv = new THREE.Mesh(new THREE.BoxGeometry(rvW, doorH * 1.15, 0.12), doorMat)
      const dbl = new THREE.Mesh(new THREE.BoxGeometry(dblW, doorH, 0.12), doorMat)
      const gap = 0.25
      const pairW = rvW + dblW + gap
      const startX = garageX - pairW / 2
      rv.position.set(startX + rvW / 2, doorH * 1.15 * 0.5, garageFrontZ)
      dbl.position.set(startX + rvW + gap + dblW / 2, doorH * 0.5, garageFrontZ)
      house.add(rv, dbl)
    } else {
      // Side-entry: tall RV door still on the front; main doors on the outer side
      const rvW = garageW * 0.55
      const rvH = spec.garageHeightM * 0.82
      const rv = new THREE.Mesh(new THREE.BoxGeometry(rvW, rvH, 0.12), doorMat)
      rv.position.set(garageX, rvH * 0.5, garageFrontZ)
      house.add(rv)

      const sideDoorW = garageDepth * 0.55
      const sideDoorH = spec.garageHeightM * 0.62
      const sideDoor = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, sideDoorH, sideDoorW),
        doorMat
      )
      const sideX = garageOnLeft
        ? garageX - garageW / 2 - 0.06
        : garageX + garageW / 2 + 0.06
      sideDoor.position.set(sideX, sideDoorH * 0.5, -D * 0.02)
      house.add(sideDoor)
    }
  }

  // Front porch
  const porchW = mainW * 0.48
  const porch = new THREE.Group()
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(porchW, 0.18, spec.porchDepthM),
    trim
  )
  slab.position.y = 0.09
  porch.add(slab)
  const shedRoof = new THREE.Mesh(
    new THREE.BoxGeometry(porchW, 0.14, spec.porchDepthM),
    roof
  )
  shedRoof.position.y = spec.wallM * 0.86
  shedRoof.rotation.x = -0.12
  porch.add(shedRoof)
  for (const px of [-porchW / 2 + 0.2, porchW / 2 - 0.2]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, spec.wallM * 0.86, 8),
      trim
    )
    post.position.set(px, (spec.wallM * 0.86) / 2, -spec.porchDepthM / 2 + 0.2)
    porch.add(post)
  }
  porch.position.set(mainX, 0, -D * 0.44 - spec.porchDepthM / 2 + 0.2)
  house.add(porch)

  // Front door
  const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.1), trim)
  frontDoor.position.set(mainX, 1.15, -D * 0.44 - 0.05)
  house.add(frontDoor)

  // Windows on the front face for scale
  const winGeo = new THREE.BoxGeometry(1.4, 1.6, 0.08)
  const frontZ = -D * 0.46
  const winXs = garageOnLeft
    ? [mainX - mainW * 0.22, mainX + mainW * 0.18, mainX + mainW * 0.38]
    : [mainX - mainW * 0.38, mainX - mainW * 0.18, mainX + mainW * 0.22]
  for (const wx of winXs) {
    const win = new THREE.Mesh(winGeo, glass)
    win.position.set(wx, 1.7, frontZ)
    house.add(win)
  }

  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  return house
}

export function houseFootprint(planId: string): { wM: number; dM: number } {
  const spec = resolveSpec(planId)
  return { wM: spec.widthFt * FT_TO_M, dM: spec.depthFt * FT_TO_M }
}
