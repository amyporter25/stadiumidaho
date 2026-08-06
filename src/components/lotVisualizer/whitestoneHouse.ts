import * as THREE from 'three'
import { FT_TO_M } from './geo'

/**
 * Whitestone exterior massing from the ArchyBase-style refs:
 * - Street front: tall RV bay + two-car garage on the LEFT, timber-truss entry,
 *   living wing with shutters on the right
 * - Rear: large glazed gable / window wall
 *
 * Origin = footprint center at ground; front faces −z (street).
 * Not a BIM model — readable modern-farmhouse volume for Lot Studio.
 */

const W_FT = 94
const D_FT = 70

function solid(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 })
}

function boardBattenMat(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f2efe6'
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = 'rgba(0,0,0,0.07)'
  for (let x = 0; x < 256; x += 16) ctx.fillRect(x, 0, 2, 256)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  for (let x = 3; x < 256; x += 16) ctx.fillRect(x, 0, 1, 256)
  const map = new THREE.CanvasTexture(c)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(5, 3)
  map.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.02,
  })
}

function shingleMat(): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#2a2a28'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
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

/** Front-facing gable roof extruded along local Z (depth). */
function gableAlongZ(
  width: number,
  depth: number,
  wallH: number,
  rise: number,
  wall: THREE.Material,
  roof: THREE.Material,
  overhang = 0.4
): THREE.Group {
  const g = new THREE.Group()
  const walls = new THREE.Mesh(new THREE.BoxGeometry(width, wallH, depth), wall)
  walls.position.y = wallH / 2
  g.add(walls)

  const hw = width / 2 + overhang
  const shape = new THREE.Shape()
  shape.moveTo(-hw, 0)
  shape.lineTo(hw, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  const roofGeo = new THREE.ExtrudeGeometry(shape, {
    depth: depth + overhang * 2,
    bevelEnabled: false,
  })
  roofGeo.translate(0, 0, -(depth + overhang * 2) / 2)
  const roofMesh = new THREE.Mesh(roofGeo, roof)
  roofMesh.position.y = wallH
  g.add(roofMesh)
  return g
}

/** Ridge running left–right (gable ends face ±x). */
function gableAlongX(
  width: number,
  depth: number,
  wallH: number,
  rise: number,
  wall: THREE.Material,
  roof: THREE.Material,
  overhang = 0.4
): THREE.Group {
  const g = gableAlongZ(depth, width, wallH, rise, wall, roof, overhang)
  g.rotation.y = Math.PI / 2
  return g
}

function addWindow(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  withShutters: boolean,
  glass: THREE.Material,
  trim: THREE.Material,
  shutter: THREE.Material
) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.08), trim)
  frame.position.set(x, y, z)
  parent.add(frame)
  const pane = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), glass)
  pane.position.set(x, y, z - 0.04)
  parent.add(pane)
  if (withShutters) {
    const sw = w * 0.28
    for (const sx of [x - w / 2 - sw / 2 - 0.04, x + w / 2 + sw / 2 + 0.04]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(sw, h * 0.95, 0.06), shutter)
      s.position.set(sx, y, z - 0.01)
      parent.add(s)
    }
  }
}

/**
 * Build the Whitestone as a recognizable modern-farmhouse exterior.
 */
export function buildWhitestoneHouse(): THREE.Group {
  const W = W_FT * FT_TO_M
  const D = D_FT * FT_TO_M
  const wallH = 3.15
  const roofRise = 2.85
  const garageH = 4.55

  const siding = boardBattenMat()
  const roof = shingleMat()
  const wood = solid(0xb08a5a, 0.7)
  const trim = solid(0x1a1a1a, 0.75)
  const doorWhite = solid(0xeceae4, 0.8)
  const doorBlack = solid(0x1c1c1c, 0.65)
  const glass = new THREE.MeshStandardMaterial({
    color: 0x6a8496,
    roughness: 0.12,
    metalness: 0.55,
    transparent: true,
    opacity: 0.82,
  })
  const shutter = solid(0x1a1a1a, 0.85)
  const concrete = solid(0xb8b6ae, 0.95)

  const house = new THREE.Group()
  house.name = 'house-whitestone'
  house.userData.planId = 'whitestone-front'
  house.userData.widthM = W
  house.userData.depthM = D
  house.userData.wallM = wallH
  house.userData.roofRiseM = roofRise
  house.userData.garageHeightM = garageH
  house.userData.facadeMode = true

  // --- Wing widths (street view, left → right) ---
  const garageW = W * 0.42
  const entryW = W * 0.22
  const livingW = W - garageW - entryW
  const garageX = -W / 2 + garageW / 2
  const entryX = -W / 2 + garageW + entryW / 2
  const livingX = W / 2 - livingW / 2

  // Main living / bedroom mass (ridge left–right)
  const mainDepth = D * 0.9
  const main = gableAlongX(livingW + entryW * 0.35, mainDepth, wallH, roofRise, siding, roof)
  main.position.set((entryX + livingX) / 2 + livingW * 0.08, 0, D * 0.02)
  house.add(main)

  // Garage + RV wing (front-facing gables) — LEFT of street elevation
  const garageDepth = D * 0.78
  const garageFrontZ = -D * 0.02 - garageDepth / 2

  const rvW = garageW * 0.38
  const dblW = garageW * 0.52
  const rvX = garageX - garageW / 2 + rvW / 2 + 0.15
  const dblX = garageX + garageW / 2 - dblW / 2 - 0.1

  const rvBay = gableAlongZ(rvW + 0.6, garageDepth, garageH, roofRise * 0.75, siding, roof, 0.3)
  rvBay.position.set(rvX, 0, -D * 0.02)
  house.add(rvBay)

  const dblBay = gableAlongZ(dblW + 0.5, garageDepth * 0.92, wallH + 0.15, roofRise * 0.7, siding, roof, 0.28)
  dblBay.position.set(dblX, 0, -D * 0.01)
  house.add(dblBay)

  // Garage doors (white paneled)
  const rvDoorH = garageH * 0.78
  const rvDoor = new THREE.Mesh(new THREE.BoxGeometry(rvW * 0.88, rvDoorH, 0.12), doorWhite)
  rvDoor.position.set(rvX, rvDoorH / 2, garageFrontZ - 0.06)
  house.add(rvDoor)
  for (let i = 1; i < 5; i++) {
    const groove = new THREE.Mesh(
      new THREE.BoxGeometry(rvW * 0.82, 0.03, 0.02),
      solid(0xd0cec6, 0.9)
    )
    groove.position.set(rvX, (rvDoorH * i) / 5, garageFrontZ - 0.13)
    house.add(groove)
  }

  const dblDoorH = wallH * 0.72
  const dblDoor = new THREE.Mesh(new THREE.BoxGeometry(dblW * 0.9, dblDoorH, 0.12), doorWhite)
  dblDoor.position.set(dblX, dblDoorH / 2, garageFrontZ + 0.35)
  house.add(dblDoor)
  for (let i = 1; i < 4; i++) {
    const groove = new THREE.Mesh(
      new THREE.BoxGeometry(dblW * 0.84, 0.03, 0.02),
      solid(0xd0cec6, 0.9)
    )
    groove.position.set(dblX, (dblDoorH * i) / 4, garageFrontZ + 0.28)
    house.add(groove)
  }

  // Small gable window above double garage
  addWindow(
    house,
    dblX,
    wallH + roofRise * 0.28,
    garageFrontZ + 0.4,
    0.55,
    1.1,
    false,
    glass,
    trim,
    shutter
  )

  // --- Timber-truss entry porch (center) ---
  const porchDepth = 3.2
  const porchZ = -D * 0.42 - porchDepth / 2
  const porchSlab = new THREE.Mesh(
    new THREE.BoxGeometry(entryW * 0.92, 0.16, porchDepth),
    concrete
  )
  porchSlab.position.set(entryX, 0.08, porchZ)
  house.add(porchSlab)

  const postH = wallH * 0.92
  for (const px of [entryX - entryW * 0.32, entryX + entryW * 0.32]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, postH, 0.28), wood)
    post.position.set(px, postH / 2, porchZ - porchDepth / 2 + 0.35)
    house.add(post)
  }
  // Gable truss over entry
  const entryGable = gableAlongZ(entryW * 0.85, porchDepth * 0.55, wallH * 1.02, roofRise * 0.55, siding, roof, 0.2)
  entryGable.position.set(entryX, 0, porchZ - 0.2)
  house.add(entryGable)
  // Timber beams under gable
  const beam = new THREE.Mesh(new THREE.BoxGeometry(entryW * 0.7, 0.16, 0.2), wood)
  beam.position.set(entryX, wallH * 0.88, porchZ - porchDepth / 2 + 0.5)
  house.add(beam)
  const braceL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), wood)
  braceL.position.set(entryX - entryW * 0.18, wallH * 0.55, porchZ - porchDepth / 2 + 0.5)
  braceL.rotation.z = 0.55
  house.add(braceL)
  const braceR = braceL.clone()
  braceR.position.x = entryX + entryW * 0.18
  braceR.rotation.z = -0.55
  house.add(braceR)

  // Black double front doors
  const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.4, 0.12), doorBlack)
  frontDoor.position.set(entryX, 1.28, -D * 0.42 - 0.02)
  house.add(frontDoor)
  const doorGlassL = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.8), glass)
  doorGlassL.position.set(entryX - 0.38, 1.35, -D * 0.42 - 0.09)
  house.add(doorGlassL)
  const doorGlassR = doorGlassL.clone()
  doorGlassR.position.x = entryX + 0.38
  house.add(doorGlassR)

  // Living-wing front windows
  const livingFrontZ = -D * 0.46
  addWindow(house, livingX - livingW * 0.22, 1.7, livingFrontZ, 1.1, 1.7, false, glass, trim, shutter)
  addWindow(house, livingX + livingW * 0.18, 1.7, livingFrontZ, 2.0, 1.55, true, glass, trim, shutter)

  // Gooseneck-style lights (simple cylinders)
  for (const lx of [rvX, dblX, entryX - 0.9, entryX + 0.9]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), trim)
    arm.rotation.z = Math.PI / 2
    arm.position.set(lx, wallH * 0.95, livingFrontZ - 0.15)
    house.add(arm)
  }

  // --- Rear elevation: large glazed gable (reads from orbit) ---
  const rearZ = D * 0.42
  const rearCenterX = entryX + entryW * 0.1
  const rearGableW = (livingW + entryW) * 0.62
  const rearGable = gableAlongZ(
    rearGableW,
    D * 0.28,
    wallH * 1.08,
    roofRise * 0.95,
    siding,
    roof,
    0.28
  )
  rearGable.position.set(rearCenterX, 0, rearZ)
  house.add(rearGable)

  // Window wall (grid) — pushed to the rear face so it reads clearly
  const wallGlassW = rearGableW * 0.78
  const wallGlassH = wallH * 0.95
  const rearFaceZ = rearZ + D * 0.14
  const cols = 3
  const rows = 2
  const cellW = wallGlassW / cols
  const cellH = wallGlassH / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = rearCenterX + (c - 1) * cellW
      const gy = 0.4 + cellH / 2 + r * cellH
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(cellW * 0.96, cellH * 0.96, 0.08),
        trim
      )
      frame.position.set(gx, gy, rearFaceZ)
      house.add(frame)
      const pane = new THREE.Mesh(new THREE.BoxGeometry(cellW * 0.86, cellH * 0.86, 0.06), glass)
      pane.position.set(gx, gy, rearFaceZ + 0.06)
      house.add(pane)
    }
  }
  // Triangular gable glass
  const peakGlass = new THREE.Mesh(new THREE.BoxGeometry(wallGlassW * 0.55, 1.7, 0.08), glass)
  peakGlass.position.set(rearCenterX, wallH + 1.05, rearFaceZ + 0.06)
  house.add(peakGlass)
  const peakFrame = new THREE.Mesh(new THREE.BoxGeometry(wallGlassW * 0.62, 1.85, 0.06), trim)
  peakFrame.position.set(rearCenterX, wallH + 1.05, rearFaceZ)
  house.add(peakFrame)

  // Rear side windows
  addWindow(
    house,
    livingX + livingW * 0.2,
    1.65,
    rearZ + D * 0.05,
    1.8,
    1.45,
    false,
    glass,
    trim,
    shutter
  )
  addWindow(
    house,
    garageX + garageW * 0.15,
    1.65,
    rearZ - D * 0.05,
    1.6,
    1.45,
    false,
    glass,
    trim,
    shutter
  )

  // Wood columns flanking rear glass
  for (const px of [
    entryX + entryW * 0.15 - wallGlassW / 2 - 0.2,
    entryX + entryW * 0.15 + wallGlassW / 2 + 0.2,
  ]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, wallH * 0.95, 0.32), wood)
    col.position.set(px, wallH * 0.48, rearZ + D * 0.1)
    house.add(col)
  }

  // Driveway tip — center of the two front garage doors (left wing)
  const approach = new THREE.Object3D()
  approach.name = 'garageApproach'
  approach.position.set((rvX + dblX) / 2, 0, garageFrontZ - 0.5)
  house.add(approach)

  // Soft contact pad under footprint
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.02, D * 1.02),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    })
  )
  pad.rotation.x = -Math.PI / 2
  pad.position.y = 0.02
  pad.name = 'footprintPad'
  house.add(pad)

  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  // Peak height for camera framing
  house.userData.facadeHeightM = garageH + roofRise * 0.75

  return house
}

export const whitestoneFootprintFt = { width: W_FT, depth: D_FT }
export const whitestoneFootprintM = {
  wM: W_FT * FT_TO_M,
  dM: D_FT * FT_TO_M,
}

/** Garage center as fraction of width from center (−0.5 left … +0.5 right). */
export const whitestoneGarageXFrac = -0.28
