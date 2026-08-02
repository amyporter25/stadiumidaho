import * as THREE from 'three'
import { FT_TO_M } from './geo'

/**
 * Simplified-but-recognizable 3D massing for each Blackstone plan, built
 * from the footprint dimensions and the elevation photos. The goal is not
 * photorealism — it's that a buyer standing on the street can read
 * "that's the Brownstone": right scale, right roofline, garage where the
 * garage is, porch where the porch is.
 *
 * Each model is a THREE.Group whose origin is the center of the footprint
 * at ground level, with the FRONT of the house facing -z (so rotation 0
 * puts the front toward the street when the street is north of the lot;
 * we rotate per-lot to face the actual road).
 */

interface HouseSpec {
  widthFt: number
  depthFt: number
  wallM: number // wall height
  roofRiseM: number // ridge height above walls
  garageWing: 'right' | 'left' | 'none'
  garageWidthFrac: number // fraction of total width
  garageHeightM: number
  porchDepthM: number
  siding: number
  roof: number
  trim: number
}

const SPECS: Record<string, HouseSpec> = {
  brownstone: {
    widthFt: 96, depthFt: 78,
    wallM: 3.4, roofRiseM: 2.6,
    garageWing: 'right', garageWidthFrac: 0.42, garageHeightM: 4.6, // RV bay is tall
    porchDepthM: 4.3,
    siding: 0xd8d2c4, roof: 0x6b6357, trim: 0xb59a6d,
  },
  whitestone: {
    widthFt: 94, depthFt: 82,
    wallM: 3.2, roofRiseM: 2.9,
    garageWing: 'right', garageWidthFrac: 0.4, garageHeightM: 4.6,
    porchDepthM: 3.0,
    siding: 0xe9e6dd, roof: 0x30302f, trim: 0x9c7b52,
  },
  sunstone: {
    widthFt: 104, depthFt: 72,
    wallM: 3.3, roofRiseM: 2.7,
    garageWing: 'right', garageWidthFrac: 0.44, garageHeightM: 4.6,
    porchDepthM: 3.2,
    siding: 0xded8cc, roof: 0x55504a, trim: 0x8a6a48,
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

  // walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat)
  walls.position.y = wallH / 2
  walls.castShadow = true
  walls.receiveShadow = true
  g.add(walls)

  // roof: triangular prism via ExtrudeGeometry of a triangle, ridge along x
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
  // rotate so ridge runs along x (extrude makes ridge along z by default) — keep as is: ridge along z here
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.position.y = wallH
  roof.castShadow = true
  roof.receiveShadow = true
  g.add(roof)

  return g
}

/** gabled block with ridge running front-to-back (z) — for garage wings */
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

export function buildHouse(planId: string): THREE.Group {
  const spec = SPECS[planId] ?? SPECS.brownstone
  const W = spec.widthFt * FT_TO_M
  const D = spec.depthFt * FT_TO_M

  const siding = mat(spec.siding)
  const roof = mat(spec.roof, 0.95)
  const trim = mat(spec.trim, 0.8)
  const glass = new THREE.MeshStandardMaterial({
    color: 0x2a3540, roughness: 0.2, metalness: 0.6,
  })

  const house = new THREE.Group()

  const garageW = W * spec.garageWidthFrac
  const mainW = W - garageW
  const mainX = -W / 2 + mainW / 2 // main block to the left

  // main house block, ridge front-to-back for the farmhouse look
  const main = gabledBlockZ(mainW, D * 0.92, spec.wallM, spec.roofRiseM, siding, roof)
  main.position.set(mainX, 0, D * 0.02)
  house.add(main)

  // garage wing (taller RV bay), ridge left-to-right, stepped slightly forward
  if (spec.garageWing !== 'none') {
    const garage = gabledBlock(
      garageW, D * 0.8, spec.garageHeightM, spec.roofRiseM * 0.85, siding, roof
    )
    garage.position.set(W / 2 - garageW / 2, 0, -D * 0.04)
    house.add(garage)

    // garage door on the front face
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(garageW * 0.62, spec.garageHeightM * 0.72, 0.12),
      trim
    )
    door.position.set(
      W / 2 - garageW / 2,
      spec.garageHeightM * 0.36,
      -D * 0.04 - (D * 0.8) / 2 - 0.06
    )
    house.add(door)
  }

  // front porch: low slab + posts + shed roof
  const porchW = mainW * 0.5
  const porch = new THREE.Group()
  const slab = new THREE.Mesh(new THREE.BoxGeometry(porchW, 0.18, spec.porchDepthM), trim)
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

  // front door
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.1), trim)
  door.position.set(mainX, 1.15, -D * 0.44 - 0.05)
  house.add(door)

  // a few windows on the front face for scale
  const winGeo = new THREE.BoxGeometry(1.4, 1.6, 0.08)
  const frontZ = -D * 0.46
  const winXs = [-W * 0.32, -W * 0.14, W * 0.06]
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
  const spec = SPECS[planId] ?? SPECS.brownstone
  return { wM: spec.widthFt * FT_TO_M, dM: spec.depthFt * FT_TO_M }
}
