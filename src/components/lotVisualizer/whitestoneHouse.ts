import * as THREE from 'three'
import { FT_TO_M } from './geo'

/**
 * Whitestone Lot Studio massing — simple coherent volumes, not BIM detail.
 *
 * Convention: origin = footprint center at ground; street facade faces −z.
 * Front/rear marketing photos are mapped onto dedicated elevation faces
 * (UV 0–1, ClampToEdge — no tiling/stretch beyond aspect fit).
 */

const W_FT = 94
const D_FT = 58

export const WHITESTONE_FRONT_SKIN = '/plans/refs/whitestone-front.png?v=mass1'
export const WHITESTONE_REAR_SKIN = '/plans/refs/whitestone-rear.png?v=mass1'

const SIDING = 0xf2efe6
const ROOF = 0x2a2a28

function mat(color: number, roughness = 0.88): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.03,
    side: THREE.FrontSide,
  })
}

/** Simple gable roof prism (ridge along local X). */
function gableRoof(width: number, depth: number, rise: number, material: THREE.Material): THREE.Mesh {
  // Triangle extruded along X via Extrude along Z then rotate — keep it obvious.
  const shape = new THREE.Shape()
  const hw = width / 2
  shape.moveTo(-hw, 0)
  shape.lineTo(hw, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  // Center on XZ: extrude goes +Z from 0
  geo.translate(0, 0, -depth / 2)
  const mesh = new THREE.Mesh(geo, material)
  // Shape is in XY; we want ridge along X spanning depth in Z — already correct
  return mesh
}

/**
 * Build a solid, orbit-stable Whitestone massing.
 * Front (−z) and rear (+z) elevation meshes receive the photos later.
 */
export function buildWhitestoneHouse(): THREE.Group {
  const W = W_FT * FT_TO_M
  const D = D_FT * FT_TO_M
  const wallH = 3.2
  const garageH = 4.4
  const roofRise = 2.4

  const roofMat = mat(ROOF, 0.95)
  const sideMat = mat(SIDING, 0.9)

  const house = new THREE.Group()
  house.name = 'house-whitestone'
  house.userData.planId = 'whitestone-front'
  house.userData.widthM = W
  house.userData.depthM = D
  house.userData.wallM = wallH
  house.userData.roofRiseM = roofRise
  house.userData.garageHeightM = garageH
  house.userData.facadeMode = true

  // --- Proportions (street left → right): garage | living ---
  const garageW = W * 0.4
  const livingW = W - garageW
  const garageX = -W / 2 + garageW / 2
  const livingX = W / 2 - livingW / 2

  // Garage sits slightly proud toward the street so the mass reads in orbit
  const garageDepth = D * 0.92
  const livingDepth = D
  const garageZ = -D / 2 + garageDepth / 2 + 0.15
  const livingZ = 0

  // Living / bedroom volume — one solid box (no orphan window chunks)
  const living = new THREE.Mesh(
    new THREE.BoxGeometry(livingW, wallH, livingDepth),
    sideMat
  )
  living.name = 'massLiving'
  living.position.set(livingX, wallH / 2, livingZ)
  house.add(living)

  // Garage / RV volume — taller, left, joined to living
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(garageW, garageH, garageDepth),
    sideMat
  )
  garage.name = 'massGarage'
  garage.position.set(garageX, garageH / 2, garageZ)
  house.add(garage)

  // Roofs — simple closed gable prisms (no open faces / orphan chunks).
  // gableRoof builds ridge along Z; yaw 90° → ridge along X, gables face ±Z.
  const livingRoof = gableRoof(livingDepth + 0.5, livingW + 0.5, roofRise, roofMat)
  livingRoof.rotation.y = Math.PI / 2
  livingRoof.name = 'roofLiving'
  livingRoof.position.set(livingX, wallH, livingZ)
  house.add(livingRoof)

  // Garage: street-facing gable (same yaw) on the taller volume
  const garageRoof = gableRoof(garageDepth + 0.35, garageW + 0.35, roofRise * 0.75, roofMat)
  garageRoof.rotation.y = Math.PI / 2
  garageRoof.name = 'roofGarage'
  garageRoof.position.set(garageX, garageH, garageZ)
  house.add(garageRoof)

  // Elevation face height covers garage peak for a full photo fit
  const elevH = garageH + roofRise * 0.55
  house.userData.facadeHeightM = elevH

  // Front elevation face — flush with street face of the garage mass (−z)
  const frontFace = makeElevationFace('streetFacade', W, elevH, true)
  frontFace.position.set(0, elevH / 2, -D / 2)
  house.add(frontFace)

  // Rear elevation face — flush with rear of the living mass (+z)
  const rearFace = makeElevationFace('rearFacade', W, elevH, false)
  rearFace.position.set(0, elevH / 2, D / 2)
  house.add(rearFace)

  // Driveway tip — center of left garage wing, exactly on the street face
  const approach = new THREE.Object3D()
  approach.name = 'garageApproach'
  approach.position.set(garageX, 0, -D / 2)
  house.add(approach)

  // Thin threshold slab under the garage doors — driveway meets this flush
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(garageW * 0.95, 0.06, 0.9),
    mat(0xc8c6be, 0.95)
  )
  threshold.name = 'garageThreshold'
  threshold.position.set(garageX, 0.03, -D / 2 - 0.35)
  house.add(threshold)

  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  return house
}

/**
 * Dedicated elevation quad. Starts neutral; applyWhitestoneSkins() swaps in
 * the photo with ClampToEdge UVs so it never tiles.
 */
function makeElevationFace(
  name: string,
  widthM: number,
  heightM: number,
  faceStreet: boolean
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1, 1)
  // PlaneGeometry faces +z by default. Street needs to face −z.
  const mat = new THREE.MeshStandardMaterial({
    color: SIDING,
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.FrontSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = name
  mesh.userData.isStreetFacade = faceStreet
  mesh.userData.isElevationSkin = true
  mesh.scale.set(widthM, heightM, 1)
  if (faceStreet) {
    mesh.rotation.y = Math.PI
  }
  return mesh
}

function configureElevationTexture(tex: THREE.Texture): void {
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set(1, 1)
  tex.offset.set(0, 0)
  tex.center.set(0.5, 0.5)
  tex.rotation = 0
  tex.anisotropy = 8
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
}

/**
 * Project front/rear photos onto the elevation faces.
 * Aspect-correct: width locks to house width; height follows photo aspect
 * so the image is not stretched. Face bottom stays on the ground plane.
 */
export function applyWhitestoneSkins(
  house: THREE.Group,
  front: THREE.Texture,
  rear?: THREE.Texture | null
): void {
  const W = house.userData.widthM as number

  const apply = (mesh: THREE.Mesh | undefined, tex: THREE.Texture | null | undefined) => {
    if (!mesh || !tex) return
    configureElevationTexture(tex)
    const m = mesh.material as THREE.MeshStandardMaterial
    m.map?.dispose()
    m.map = tex
    m.color.set(0xffffff)
    m.transparent = true
    // Hard cut — no soft halo / fringe at the foundation
    m.alphaTest = 0.5
    m.depthWrite = true
    m.needsUpdate = true

    const img = tex.image as { width?: number; height?: number } | undefined
    if (img?.width && img.height) {
      const h = W / (img.width / img.height)
      mesh.scale.set(W, h, 1)
      mesh.position.y = h / 2
      house.userData.facadeHeightM = h
    }
    mesh.visible = true
  }

  apply(house.getObjectByName('streetFacade') as THREE.Mesh | undefined, front)
  apply(house.getObjectByName('rearFacade') as THREE.Mesh | undefined, rear ?? null)
  house.userData.hasPhotorealSkins = true
}

export const whitestoneFootprintFt = { width: W_FT, depth: D_FT }
export const whitestoneFootprintM = {
  wM: W_FT * FT_TO_M,
  dM: D_FT * FT_TO_M,
}

/** Garage center as fraction of width from center (−0.5 left … +0.5 right). */
export const whitestoneGarageXFrac = -0.28
