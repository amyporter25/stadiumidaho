import * as THREE from 'three'
import { FT_TO_M } from './geo'

/**
 * Whitestone as a real 3D massing (no photo billboards / elevation cards).
 *
 * Reads from the ArchyBase / dollhouse refs:
 * - Street (−z): tall RV + two-car garage on the LEFT, timber entry center,
 *   living windows on the right
 * - Rear (+z): large glazed gable
 *
 * Origin = footprint center at ground. Orbit-stable solid volumes only —
 * no floating 2D image planes on the front or back.
 */

const W_FT = 94
const D_FT = 58

function solid(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.04,
    side: THREE.FrontSide,
  })
}

function boardBatten(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f2efe6'
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  for (let x = 0; x < 256; x += 14) ctx.fillRect(x, 0, 2, 256)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let x = 3; x < 256; x += 14) ctx.fillRect(x, 0, 1, 256)
  const map = new THREE.CanvasTexture(c)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(6, 3)
  map.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.02,
  })
}

function shingles(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#2a2a28'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  for (let y = 0; y < 256; y += 9) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y)
    ctx.stroke()
    const off = (y / 9) % 2 === 0 ? 0 : 11
    for (let x = off; x < 256; x += 22) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + 9)
      ctx.stroke()
    }
  }
  const map = new THREE.CanvasTexture(c)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(7, 5)
  map.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0.03,
  })
}

/** Closed gable prism. Ridge along local X after yaw π/2. */
function gableRoof(
  spanAlongRidge: number,
  spanAcross: number,
  rise: number,
  material: THREE.Material
): THREE.Mesh {
  const shape = new THREE.Shape()
  const hw = spanAcross / 2
  shape.moveTo(-hw, 0)
  shape.lineTo(hw, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: spanAlongRidge,
    bevelEnabled: false,
  })
  geo.translate(0, 0, -spanAlongRidge / 2)
  const mesh = new THREE.Mesh(geo, material)
  mesh.rotation.y = Math.PI / 2
  return mesh
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  m.position.set(x, y, z)
  return m
}

/**
 * Solid Whitestone massing — looks like a house from every orbit angle.
 * No 2D photo cards on the front or back.
 */
export function buildWhitestoneHouse(): THREE.Group {
  const W = W_FT * FT_TO_M
  const D = D_FT * FT_TO_M
  const wallH = 3.2
  const garageH = 4.45
  const roofRise = 2.35

  const siding = boardBatten()
  const roofMat = shingles()
  const wood = solid(0xb08a5a, 0.7)
  const trim = solid(0x1a1a1a, 0.75)
  const doorWhite = solid(0xeceae4, 0.82)
  const doorBlack = solid(0x1c1c1c, 0.65)
  const glass = new THREE.MeshStandardMaterial({
    color: 0x6a8496,
    roughness: 0.12,
    metalness: 0.55,
    transparent: true,
    opacity: 0.78,
    side: THREE.FrontSide,
  })
  const concrete = solid(0xc8c6be, 0.95)

  const house = new THREE.Group()
  house.name = 'house-whitestone'
  house.userData.planId = 'whitestone-front'
  house.userData.widthM = W
  house.userData.depthM = D
  house.userData.wallM = wallH
  house.userData.roofRiseM = roofRise
  house.userData.garageHeightM = garageH
  house.userData.facadeMode = true
  house.userData.hasPhotorealSkins = false

  // Street left → right: garage wing | entry | living
  const garageW = W * 0.4
  const entryW = W * 0.2
  const livingW = W - garageW - entryW
  const garageX = -W / 2 + garageW / 2
  const entryX = -W / 2 + garageW + entryW / 2
  const livingX = W / 2 - livingW / 2

  const livingDepth = D
  const garageDepth = D * 0.9
  const garageFrontZ = -D / 2
  const garageCenterZ = garageFrontZ + garageDepth / 2

  // --- Main living volume (solid) ---
  house.add(box(livingW + entryW * 0.35, wallH, livingDepth, siding, (entryX + livingX) / 2 + livingW * 0.05, wallH / 2, 0))

  // --- Garage + RV wing (left, taller, street-proud) ---
  house.add(box(garageW, garageH, garageDepth, siding, garageX, garageH / 2, garageCenterZ))

  // Roofs (closed prisms)
  const mainRoof = gableRoof(livingW + entryW * 0.5 + 0.4, livingDepth + 0.4, roofRise, roofMat)
  mainRoof.position.set((entryX + livingX) / 2 + livingW * 0.05, wallH, 0)
  house.add(mainRoof)

  const garageRoof = gableRoof(garageDepth + 0.3, garageW + 0.3, roofRise * 0.7, roofMat)
  garageRoof.position.set(garageX, garageH, garageCenterZ)
  house.add(garageRoof)

  // --- Garage doors (recessed into street face — real geometry, not a photo) ---
  const rvW = garageW * 0.38
  const dblW = garageW * 0.5
  const rvX = garageX - garageW / 2 + rvW / 2 + 0.2
  const dblX = garageX + garageW / 2 - dblW / 2 - 0.15
  const doorZ = garageFrontZ + 0.08

  const rvH = garageH * 0.78
  house.add(box(rvW * 0.9, rvH, 0.1, doorWhite, rvX, rvH / 2, doorZ))
  for (let i = 1; i < 5; i++) {
    house.add(box(rvW * 0.82, 0.03, 0.02, solid(0xd0cec6, 0.9), rvX, (rvH * i) / 5, doorZ - 0.06))
  }

  const dblH = wallH * 0.72
  house.add(box(dblW * 0.92, dblH, 0.1, doorWhite, dblX, dblH / 2, doorZ + 0.25))
  for (let i = 1; i < 4; i++) {
    house.add(box(dblW * 0.84, 0.03, 0.02, solid(0xd0cec6, 0.9), dblX, (dblH * i) / 4, doorZ + 0.18))
  }
  // Door-top lights / small gable window cue
  house.add(box(0.45, 0.9, 0.08, glass, dblX, wallH + roofRise * 0.2, doorZ + 0.3))

  // --- Timber entry porch (center) ---
  const porchDepth = 2.8
  const porchZ = -D / 2 + porchDepth / 2 + 0.15
  house.add(box(entryW * 0.9, 0.14, porchDepth, concrete, entryX, 0.07, porchZ))

  const postH = wallH * 0.9
  for (const px of [entryX - entryW * 0.28, entryX + entryW * 0.28]) {
    house.add(box(0.26, postH, 0.26, wood, px, postH / 2, -D / 2 + 0.35))
  }
  // Entry gable volume
  const entryGable = gableRoof(porchDepth * 0.7, entryW * 0.85, roofRise * 0.5, roofMat)
  entryGable.position.set(entryX, wallH * 0.95, porchZ - 0.1)
  house.add(entryGable)
  house.add(box(entryW * 0.75, wallH * 0.95, 0.25, siding, entryX, (wallH * 0.95) / 2, porchZ - 0.15))
  house.add(box(entryW * 0.65, 0.14, 0.18, wood, entryX, wallH * 0.85, -D / 2 + 0.45))

  // Black double doors
  house.add(box(1.65, 2.35, 0.1, doorBlack, entryX, 1.25, -D / 2 + 0.2))
  house.add(box(0.5, 1.7, 0.04, glass, entryX - 0.35, 1.35, -D / 2 + 0.14))
  house.add(box(0.5, 1.7, 0.04, glass, entryX + 0.35, 1.35, -D / 2 + 0.14))

  // Living-wing street windows
  const winZ = -D / 2 + 0.12
  for (const [wx, ww, wh] of [
    [livingX - livingW * 0.2, 1.1, 1.55],
    [livingX + livingW * 0.18, 1.9, 1.45],
  ] as const) {
    house.add(box(ww + 0.12, wh + 0.12, 0.08, trim, wx, 1.65, winZ))
    house.add(box(ww, wh, 0.05, glass, wx, 1.65, winZ - 0.05))
  }

  // --- Rear: solid wall + glazed gable (joined to the main volume) ---
  const rearZ = D / 2
  const rearGableW = (livingW + entryW) * 0.55
  const rearGableDepth = D * 0.22
  house.add(
    box(rearGableW, wallH * 1.05, rearGableDepth, siding, entryX + entryW * 0.05, (wallH * 1.05) / 2, rearZ - rearGableDepth / 2)
  )
  const rearRoof = gableRoof(rearGableDepth + 0.25, rearGableW + 0.25, roofRise * 0.85, roofMat)
  rearRoof.position.set(entryX + entryW * 0.05, wallH * 1.05, rearZ - rearGableDepth / 2)
  house.add(rearRoof)

  // Window wall flush in the rear gable face
  const glassW = rearGableW * 0.72
  const glassH = wallH * 0.9
  const faceZ = rearZ - 0.06
  const cols = 3
  const rows = 2
  const cellW = glassW / cols
  const cellH = glassH / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = entryX + entryW * 0.05 + (c - 1) * cellW
      const gy = 0.45 + cellH / 2 + r * cellH
      house.add(box(cellW * 0.92, cellH * 0.92, 0.08, trim, gx, gy, faceZ))
      house.add(box(cellW * 0.8, cellH * 0.8, 0.05, glass, gx, gy, faceZ + 0.05))
    }
  }
  house.add(box(glassW * 0.5, 1.5, 0.08, glass, entryX + entryW * 0.05, wallH + 0.9, faceZ + 0.05))
  // Wood columns flanking rear glass
  for (const px of [
    entryX + entryW * 0.05 - glassW / 2 - 0.2,
    entryX + entryW * 0.05 + glassW / 2 + 0.2,
  ]) {
    house.add(box(0.28, wallH * 0.95, 0.28, wood, px, wallH * 0.48, faceZ - 0.05))
  }

  // Driveway tip — garage door center on the street face
  const approach = new THREE.Object3D()
  approach.name = 'garageApproach'
  approach.position.set((rvX + dblX) / 2, 0, garageFrontZ)
  house.add(approach)

  // Threshold slab — driveway meets flush here
  house.add(box(garageW * 0.92, 0.05, 0.75, concrete, garageX, 0.025, garageFrontZ - 0.35))

  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  return house
}

/** Kept for Studio import compatibility — skins are intentionally unused. */
export const WHITESTONE_FRONT_SKIN = ''
export const WHITESTONE_REAR_SKIN = ''

/** No-op: Whitestone is pure 3D massing (no elevation photo cards). */
export function applyWhitestoneSkins(
  _house: THREE.Group,
  _front: THREE.Texture,
  _rear?: THREE.Texture | null
): void {
  // Intentionally empty — photo billboards were removed.
}

export const whitestoneFootprintFt = { width: W_FT, depth: D_FT }
export const whitestoneFootprintM = {
  wM: W_FT * FT_TO_M,
  dM: D_FT * FT_TO_M,
}

export const whitestoneGarageXFrac = -0.28
