import * as THREE from 'three'
import { FT_TO_M } from './geo'

/**
 * Whitestone as a real rotatable 3D house — geometry + materials only.
 *
 * We do NOT paste front/rear photos onto planes. Photo cards always read as
 * a 2D square/cutout. Instead the massing is built to match the ArchyBase
 * elevations: street-view–left RV + garage, timber entry, living wing, rear
 * glass gable.
 *
 * Street faces −z. Origin = footprint center at ground.
 * Street camera looks toward +z at the facade, so viewer's left = local +x.
 */

const W_FT = 94
const D_FT = 58

/** Unused — kept so older Studio imports don't break. */
export const WHITESTONE_FRONT_SKIN = ''
export const WHITESTONE_REAR_SKIN = ''

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
  ctx.fillStyle = '#f4f1e8'
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = 'rgba(0,0,0,0.09)'
  for (let x = 0; x < 256; x += 13) ctx.fillRect(x, 0, 2, 256)
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  for (let x = 3; x < 256; x += 13) ctx.fillRect(x, 0, 1, 256)
  const map = new THREE.CanvasTexture(c)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(7, 3.5)
  map.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
  })
}

function shingles(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#242422'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 1
  for (let y = 0; y < 256; y += 8) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y)
    ctx.stroke()
    const off = (y / 8) % 2 === 0 ? 0 : 10
    for (let x = off; x < 256; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + 8)
      ctx.stroke()
    }
  }
  const map = new THREE.CanvasTexture(c)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(8, 5)
  map.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0.03,
  })
}

/** Street-facing gable volume: walls + closed roof prism as one group. */
function streetGable(
  width: number,
  depth: number,
  wallH: number,
  rise: number,
  wall: THREE.Material,
  roof: THREE.Material
): THREE.Group {
  const g = new THREE.Group()
  const walls = new THREE.Mesh(new THREE.BoxGeometry(width, wallH, depth), wall)
  walls.position.y = wallH / 2
  g.add(walls)

  const shape = new THREE.Shape()
  const hw = width / 2 + 0.15
  shape.moveTo(-hw, 0)
  shape.lineTo(hw, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  const roofGeo = new THREE.ExtrudeGeometry(shape, {
    depth: depth + 0.3,
    bevelEnabled: false,
  })
  roofGeo.translate(0, 0, -(depth + 0.3) / 2)
  const roofMesh = new THREE.Mesh(roofGeo, roof)
  roofMesh.position.y = wallH
  g.add(roofMesh)
  return g
}

/** Ridge left–right (gable ends face ±x). */
function sideGable(
  width: number,
  depth: number,
  wallH: number,
  rise: number,
  wall: THREE.Material,
  roof: THREE.Material
): THREE.Group {
  const g = streetGable(depth, width, wallH, rise, wall, roof)
  g.rotation.y = Math.PI / 2
  return g
}

function add(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  parent.add(m)
  return m
}

export function buildWhitestoneHouse(): THREE.Group {
  const W = W_FT * FT_TO_M
  const D = D_FT * FT_TO_M
  const wallH = 3.15
  const garageH = 4.5
  const roofRise = 2.4

  const siding = boardBatten()
  const roof = shingles()
  const wood = solid(0xb08a5a, 0.68)
  const trim = solid(0x1a1a1a, 0.72)
  const doorWhite = solid(0xeeebe4, 0.8)
  const doorBlack = solid(0x1c1c1c, 0.62)
  const shutter = solid(0x1a1a1a, 0.85)
  const glass = new THREE.MeshStandardMaterial({
    color: 0x7a96a8,
    roughness: 0.1,
    metalness: 0.5,
    transparent: true,
    opacity: 0.82,
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

  // Street-view left → right: RV, two-car, entry, living (viewer left = local +x)
  const garageW = W * 0.4
  const entryW = W * 0.22
  const livingW = W - garageW - entryW
  const garageX = W / 2 - garageW / 2
  const entryX = W / 2 - garageW - entryW / 2
  const livingX = -W / 2 + livingW / 2

  const garageDepth = D * 0.88
  const garageFrontZ = -D / 2
  const garageZ = garageFrontZ + garageDepth / 2

  // --- Main living mass (continuous solid body) ---
  const main = sideGable(livingW + entryW * 0.4, D * 0.95, wallH, roofRise, siding, roof)
  main.position.set((entryX + livingX) / 2 - livingW * 0.06, 0, 0.05)
  house.add(main)

  // --- Garage wing: RV (tall) + double bay — street-view LEFT ---
  const rvW = garageW * 0.4
  const dblW = garageW * 0.52
  // RV on the outer (+x) edge, double bay toward the entry
  const rvX = garageX + garageW / 2 - rvW / 2 - 0.12
  const dblX = garageX - garageW / 2 + dblW / 2 + 0.08

  const rvBay = streetGable(rvW + 0.45, garageDepth, garageH, roofRise * 0.72, siding, roof)
  rvBay.position.set(rvX, 0, garageZ)
  house.add(rvBay)

  const dblBay = streetGable(dblW + 0.4, garageDepth * 0.92, wallH + 0.2, roofRise * 0.65, siding, roof)
  dblBay.position.set(dblX, 0, garageZ + 0.15)
  house.add(dblBay)

  // Garage doors recessed in street face
  const rvH = garageH * 0.76
  add(house, rvW * 0.88, rvH, 0.12, doorWhite, rvX, rvH / 2, garageFrontZ + 0.1)
  for (let i = 1; i < 5; i++) {
    add(house, rvW * 0.8, 0.035, 0.03, solid(0xd4d1c8, 0.9), rvX, (rvH * i) / 5, garageFrontZ + 0.04)
  }

  const dblH = wallH * 0.7
  add(house, dblW * 0.9, dblH, 0.12, doorWhite, dblX, dblH / 2, garageFrontZ + 0.35)
  for (let i = 1; i < 4; i++) {
    add(house, dblW * 0.82, 0.035, 0.03, solid(0xd4d1c8, 0.9), dblX, (dblH * i) / 4, garageFrontZ + 0.28)
  }
  // Gable window over double garage
  add(house, 0.5, 1.0, 0.08, glass, dblX, wallH + roofRise * 0.22, garageFrontZ + 0.4)
  add(house, 0.62, 1.12, 0.06, trim, dblX, wallH + roofRise * 0.22, garageFrontZ + 0.45)

  // --- Timber entry (center) ---
  const porchD = 3.0
  const porchZ = -D / 2 + porchD / 2 + 0.2
  add(house, entryW * 0.92, 0.14, porchD, concrete, entryX, 0.07, porchZ)

  const postH = wallH * 0.92
  for (const px of [entryX - entryW * 0.3, entryX + entryW * 0.3]) {
    add(house, 0.28, postH, 0.28, wood, px, postH / 2, -D / 2 + 0.4)
  }
  const entryGable = streetGable(entryW * 0.82, porchD * 0.55, wallH * 1.02, roofRise * 0.52, siding, roof)
  entryGable.position.set(entryX, 0, porchZ - 0.15)
  house.add(entryGable)
  add(house, entryW * 0.68, 0.16, 0.2, wood, entryX, wallH * 0.88, -D / 2 + 0.55)
  // King-post braces
  const brace = add(house, 0.12, 1.15, 0.12, wood, entryX - entryW * 0.16, wallH * 0.55, -D / 2 + 0.55)
  brace.rotation.z = 0.55
  const braceR = brace.clone()
  braceR.position.x = entryX + entryW * 0.16
  braceR.rotation.z = -0.55
  house.add(braceR)

  add(house, 1.7, 2.4, 0.12, doorBlack, entryX, 1.28, -D / 2 + 0.22)
  add(house, 0.55, 1.75, 0.05, glass, entryX - 0.38, 1.35, -D / 2 + 0.15)
  add(house, 0.55, 1.75, 0.05, glass, entryX + 0.38, 1.35, -D / 2 + 0.15)

  // Living windows + shutters (wing on street-view right / local −x)
  const winZ = -D / 2 + 0.15
  for (const [wx, ww, wh, shut] of [
    [livingX + livingW * 0.22, 1.05, 1.6, false],
    [livingX - livingW * 0.12, 1.85, 1.5, true],
    [livingX - livingW * 0.38, 1.85, 1.5, true],
  ] as const) {
    add(house, ww + 0.14, wh + 0.14, 0.08, trim, wx, 1.7, winZ)
    add(house, ww, wh, 0.05, glass, wx, 1.7, winZ - 0.05)
    if (shut) {
      const sw = ww * 0.22
      add(house, sw, wh * 0.95, 0.06, shutter, wx - ww / 2 - sw / 2 - 0.04, 1.7, winZ)
      add(house, sw, wh * 0.95, 0.06, shutter, wx + ww / 2 + sw / 2 + 0.04, 1.7, winZ)
    }
  }

  // Accent gable on living wing
  const livingGable = streetGable(livingW * 0.45, D * 0.2, wallH * 1.02, roofRise * 0.55, siding, roof)
  livingGable.position.set(livingX - livingW * 0.05, 0, -D / 2 + D * 0.12)
  house.add(livingGable)
  add(house, 0.5, 1.05, 0.08, glass, livingX - livingW * 0.05, wallH + 0.55, -D / 2 + 0.25)

  // --- Rear glass gable (joined to main body — not a floating chunk) ---
  const rearCenterX = entryX - entryW * 0.08
  const rearGableW = (livingW + entryW) * 0.58
  const rearDepth = D * 0.26
  const rear = streetGable(rearGableW, rearDepth, wallH * 1.06, roofRise * 0.9, siding, roof)
  rear.position.set(rearCenterX, 0, D / 2 - rearDepth / 2)
  house.add(rear)

  const faceZ = D / 2 - 0.08
  const glassW = rearGableW * 0.74
  const glassH = wallH * 0.92
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const cellW = glassW / 3
      const cellH = glassH / 2
      const gx = rearCenterX + (c - 1) * cellW
      const gy = 0.4 + cellH / 2 + r * cellH
      add(house, cellW * 0.94, cellH * 0.94, 0.08, trim, gx, gy, faceZ)
      add(house, cellW * 0.82, cellH * 0.82, 0.05, glass, gx, gy, faceZ + 0.05)
    }
  }
  add(house, glassW * 0.48, 1.55, 0.08, glass, rearCenterX, wallH + 0.95, faceZ + 0.05)
  add(house, glassW * 0.55, 1.7, 0.06, trim, rearCenterX, wallH + 0.95, faceZ)
  for (const px of [rearCenterX - glassW / 2 - 0.22, rearCenterX + glassW / 2 + 0.22]) {
    add(house, 0.3, wallH * 0.95, 0.3, wood, px, wallH * 0.48, faceZ - 0.04)
  }

  // Secondary rear windows on living wing
  add(house, 1.7, 1.4, 0.08, trim, livingX - livingW * 0.2, 1.6, D / 2 - 0.1)
  add(house, 1.55, 1.25, 0.05, glass, livingX - livingW * 0.2, 1.6, D / 2 - 0.04)

  // Driveway tip at garage doors (street-view left = local +x)
  const doorX = (rvX + dblX) / 2
  const approach = new THREE.Object3D()
  approach.name = 'massingGarageDoor'
  approach.position.set(doorX, 0, garageFrontZ)
  house.add(approach)
  house.userData.garageLocalX = doorX
  house.userData.garageLocalZ = garageFrontZ

  // Flush threshold — driveway meets here cleanly
  add(house, garageW * 0.95, 0.05, 0.8, concrete, garageX, 0.025, garageFrontZ - 0.38)

  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  return house
}

/** No-op: photo billboards removed permanently. */
export function applyWhitestoneSkins(
  _house: THREE.Group,
  _front: THREE.Texture,
  _rear?: THREE.Texture | null
): void {}

export const whitestoneFootprintFt = { width: W_FT, depth: D_FT }
export const whitestoneFootprintM = {
  wM: W_FT * FT_TO_M,
  dM: D_FT * FT_TO_M,
}
/** Viewer-space garage center (−0.5 left … +0.5 right). Left wing ⇒ negative. */
export const whitestoneGarageXFrac = -0.28
