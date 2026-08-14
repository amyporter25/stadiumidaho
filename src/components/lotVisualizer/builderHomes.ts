import * as THREE from 'three'
import { assetUrl } from '../../lib/assetUrl'
import { FT_TO_M } from './geo'

/**
 * Builder homes as real 3D volumes (not photo cards, not solid roof prisms).
 *
 * Street faces −z. Origin = footprint center at ground.
 * Street camera looks toward +z, so viewer-left = local +x.
 *
 * Photoreal elevations are stamped onto the actual front/rear wall faces
 * (flush with the massing) via planar UVs — they are the wall, not a billboard.
 */

export const PLAN_GLB_URL: Record<string, string> = {
  'whitestone-front': assetUrl('/plans/glb/whitestone-front.glb'),
  whitestone: assetUrl('/plans/glb/whitestone-front.glb'),
  'whitestone-side': assetUrl('/plans/glb/whitestone-side.glb'),
  brownstone: assetUrl('/plans/glb/brownstone.glb'),
}

export function builderHomeMeta(planId: string): {
  widthM: number
  depthM: number
  garageEntry: 'front' | 'side'
} {
  if (planId === 'whitestone-side') {
    return { widthM: 94 * FT_TO_M, depthM: 78 * FT_TO_M, garageEntry: 'side' }
  }
  if (planId === 'brownstone') {
    return { widthM: 91 * FT_TO_M, depthM: 72 * FT_TO_M, garageEntry: 'front' }
  }
  return { widthM: 94 * FT_TO_M, depthM: 58 * FT_TO_M, garageEntry: 'front' }
}

export const PLAN_ELEVATIONS: Record<
  string,
  { front: string; rear: string | null }
> = {
  'whitestone-front': {
    front: assetUrl('/plans/refs/whitestone-front.png?v=glb1'),
    rear: assetUrl('/plans/refs/whitestone-rear.png?v=glb1'),
  },
  whitestone: {
    front: assetUrl('/plans/refs/whitestone-front.png?v=glb1'),
    rear: assetUrl('/plans/refs/whitestone-rear.png?v=glb1'),
  },
  'whitestone-side': {
    front: assetUrl('/plans/refs/whitestone-front.png?v=glb1'),
    rear: assetUrl('/plans/refs/whitestone-rear.png?v=glb1'),
  },
  brownstone: {
    front: assetUrl('/plans/cutouts/brownstone.png?v=glb1'),
    rear: null,
  },
}

function make2dCanvas(size = 256): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function sidingMap(color: string, vertical = true): THREE.CanvasTexture | undefined {
  const c = make2dCanvas()
  if (!c) return undefined
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  if (vertical) {
    for (let x = 0; x < 256; x += 14) ctx.fillRect(x, 0, 2, 256)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    for (let x = 4; x < 256; x += 14) ctx.fillRect(x, 0, 1, 256)
  } else {
    for (let y = 0; y < 256; y += 10) ctx.fillRect(0, y, 256, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 3)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function shingleMap(): THREE.CanvasTexture | undefined {
  const c = make2dCanvas()
  if (!c) return undefined
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#2a2a28'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
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
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 5)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function mat(
  color: number,
  roughness = 0.86,
  map?: THREE.Texture
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : color,
    map: map ?? null,
    roughness,
    metalness: 0.03,
    side: THREE.FrontSide,
  })
}

function shadow(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/**
 * Street-facing gable wing: rectangular body + triangular gable walls +
 * two sloped roof planes (not a filled attic prism).
 */
function addStreetGable(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  wallH: number,
  rise: number,
  x: number,
  z: number,
  wall: THREE.Material,
  roof: THREE.Material,
  fascia: THREE.Material
): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  const hw = width / 2
  const overhang = 0.32

  const body = shadow(new THREE.Mesh(new THREE.BoxGeometry(width, wallH, depth), wall))
  body.position.y = wallH / 2
  g.add(body)

  const gableShape = new THREE.Shape()
  gableShape.moveTo(-hw, 0)
  gableShape.lineTo(hw, 0)
  gableShape.lineTo(0, rise)
  gableShape.closePath()
  const gableGeo = new THREE.ShapeGeometry(gableShape)

  const frontGable = shadow(new THREE.Mesh(gableGeo, wall))
  frontGable.position.set(0, wallH, -depth / 2 - 0.005)
  frontGable.userData.elevation = 'front'
  g.add(frontGable)

  const rearGable = shadow(new THREE.Mesh(gableGeo.clone(), wall))
  rearGable.position.set(0, wallH, depth / 2 + 0.005)
  rearGable.rotation.y = Math.PI
  rearGable.userData.elevation = 'rear'
  g.add(rearGable)

  const frontWall = shadow(new THREE.Mesh(new THREE.PlaneGeometry(width, wallH), wall))
  frontWall.position.set(0, wallH / 2, -depth / 2 - 0.008)
  frontWall.userData.elevation = 'front'
  g.add(frontWall)

  const rearWall = shadow(new THREE.Mesh(new THREE.PlaneGeometry(width, wallH), wall))
  rearWall.position.set(0, wallH / 2, depth / 2 + 0.008)
  rearWall.rotation.y = Math.PI
  rearWall.userData.elevation = 'rear'
  g.add(rearWall)

  const slopeLen = Math.hypot(hw, rise) + 0.18
  const pitch = Math.atan2(rise, hw)
  const roofD = depth + overhang * 2
  const roofT = 0.09

  const leftRoof = shadow(new THREE.Mesh(new THREE.BoxGeometry(slopeLen, roofT, roofD), roof))
  leftRoof.rotation.z = pitch
  leftRoof.position.set(-hw / 2, wallH + rise / 2 + 0.04, 0)
  g.add(leftRoof)

  const rightRoof = shadow(new THREE.Mesh(new THREE.BoxGeometry(slopeLen, roofT, roofD), roof))
  rightRoof.rotation.z = -pitch
  rightRoof.position.set(hw / 2, wallH + rise / 2 + 0.04, 0)
  g.add(rightRoof)

  // Fascia along the street eave
  const fasciaBar = shadow(new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.08, 0.06), fascia))
  fasciaBar.position.set(0, wallH - 0.02, -depth / 2 - overhang * 0.4)
  g.add(fasciaBar)

  parent.add(g)
  return g
}

/** Ridge left–right (long main body). */
function addSideGable(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  wallH: number,
  rise: number,
  x: number,
  z: number,
  wall: THREE.Material,
  roof: THREE.Material,
  fascia: THREE.Material
): THREE.Group {
  const g = addStreetGable(parent, depth, width, wallH, rise, x, z, wall, roof, fascia)
  g.rotation.y = Math.PI / 2
  // After yaw, elevation tags on the original ±z faces no longer face the street.
  g.traverse((o) => {
    if (o.userData.elevation) delete o.userData.elevation
  })
  return g
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material))
  m.position.set(x, y, z)
  parent.add(m)
  return m
}

function addGarageDoor(
  parent: THREE.Object3D,
  w: number,
  h: number,
  x: number,
  z: number,
  door: THREE.Material,
  trim: THREE.Material,
  axis: 'front' | 'side' = 'front'
): THREE.Mesh {
  const frame = 0.08
  if (axis === 'front') {
    addBox(parent, w + frame * 2, h + frame, 0.08, trim, x, h / 2 + 0.02, z + 0.02)
    const slab = addBox(parent, w, h, 0.07, door, x, h / 2, z)
    const rows = Math.max(3, Math.round(h / 0.55))
    for (let i = 1; i < rows; i++) {
      addBox(parent, w * 0.92, 0.03, 0.02, trim, x, (h * i) / rows, z - 0.04)
    }
    return slab
  }
  addBox(parent, 0.08, h + frame, w + frame * 2, trim, x - 0.02, h / 2 + 0.02, z)
  const slab = addBox(parent, 0.07, h, w, door, x, h / 2, z)
  const rows = Math.max(3, Math.round(h / 0.55))
  for (let i = 1; i < rows; i++) {
    addBox(parent, 0.02, 0.03, w * 0.92, trim, x + 0.04, (h * i) / rows, z)
  }
  return slab
}

function addWindow(
  parent: THREE.Object3D,
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  glass: THREE.Material,
  trim: THREE.Material,
  shutters?: THREE.Material
): void {
  addBox(parent, w + 0.12, h + 0.12, 0.06, trim, x, y, z)
  addBox(parent, w, h, 0.04, glass, x, y, z - 0.03)
  if (shutters) {
    const sw = w * 0.22
    addBox(parent, sw, h * 0.95, 0.05, shutters, x - w / 2 - sw / 2 - 0.04, y, z)
    addBox(parent, sw, h * 0.95, 0.05, shutters, x + w / 2 + sw / 2 + 0.04, y, z)
  }
}

function addDoorNode(
  house: THREE.Group,
  name: 'GarageDoorFront' | 'GarageDoorSide',
  x: number,
  z: number
): void {
  const n = new THREE.Object3D()
  n.name = name
  n.position.set(x, 0, z)
  house.add(n)
  if (name === 'GarageDoorFront' || !house.getObjectByName('GarageDoorFront')) {
    house.userData.garageLocalX = x
    house.userData.garageLocalZ = z
  }
}

function addElevationSheet(
  house: THREE.Group,
  name: string,
  faceStreet: boolean,
  widthM: number,
  depthM: number,
  heightM: number
): void {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.02,
    transparent: true,
    alphaTest: 0.38,
    depthWrite: true,
    side: THREE.FrontSide,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
  mesh.name = name
  mesh.userData.isElevationSheet = true
  mesh.visible = false
  if (faceStreet) mesh.rotation.y = Math.PI
  mesh.scale.set(widthM, heightM, 1)
  mesh.position.set(0, heightM / 2, faceStreet ? -depthM / 2 - 0.04 : depthM / 2 + 0.04)
  house.add(mesh)
}

function finishHouse(house: THREE.Group, W: number, D: number): THREE.Group {
  house.userData.widthM = W
  house.userData.depthM = D
  house.userData.glbReady = true
  house.userData.hasPhotorealSkins = false
  addElevationSheet(house, 'frontElevationSheet', true, W, D, 8.2)
  addElevationSheet(house, 'rearElevationSheet', false, W, D, 8.2)
  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return house
}

function buildWhitestone(sideEntry: boolean): THREE.Group {
  const W = 94 * FT_TO_M
  const D = (sideEntry ? 78 : 58) * FT_TO_M
  const wallH = 3.05
  const garageH = 4.35
  const rise = 2.15

  const siding = mat(0xf4f1e8, 0.88, sidingMap('#f4f1e8', true))
  const roof = mat(0xffffff, 0.96, shingleMap())
  const wood = mat(0xb08a5a, 0.62)
  const trim = mat(0x1a1a1a, 0.7)
  const fascia = mat(0xf7f4ec, 0.8)
  const doorWhite = mat(0xeeebe4, 0.78)
  const doorBlack = mat(0x1c1c1c, 0.55)
  const shutter = mat(0x1a1a1a, 0.82)
  const glass = new THREE.MeshStandardMaterial({
    color: 0x6d8899,
    roughness: 0.12,
    metalness: 0.45,
    transparent: true,
    opacity: 0.78,
  })
  const concrete = mat(0xc8c6be, 0.95)

  const house = new THREE.Group()
  house.name = sideEntry ? 'house-whitestone-side' : 'house-whitestone-front'
  house.userData.planId = sideEntry ? 'whitestone-side' : 'whitestone-front'
  house.userData.garageEntry = sideEntry ? 'side' : 'front'

  const garageW = W * 0.4
  const entryW = W * 0.22
  const livingW = W - garageW - entryW
  const garageX = W / 2 - garageW / 2
  const entryX = W / 2 - garageW - entryW / 2
  const livingX = -W / 2 + livingW / 2
  const garageDepth = D * (sideEntry ? 0.9 : 0.86)
  const garageFrontZ = -D / 2
  const garageZ = garageFrontZ + garageDepth / 2

  addSideGable(
    house,
    livingW + entryW * 0.35,
    D * 0.94,
    wallH,
    rise,
    (entryX + livingX) / 2 - livingW * 0.04,
    0.05,
    siding,
    roof,
    fascia
  )
  const livingStreet = shadow(new THREE.Mesh(new THREE.PlaneGeometry(livingW + entryW * 0.2, wallH), siding))
  livingStreet.position.set((entryX + livingX) / 2, wallH / 2, -D / 2 + 0.02)
  livingStreet.userData.elevation = 'front'
  house.add(livingStreet)
  const livingRear = shadow(new THREE.Mesh(new THREE.PlaneGeometry(livingW * 0.7, wallH), siding))
  livingRear.position.set(livingX, wallH / 2, D / 2 - 0.02)
  livingRear.rotation.y = Math.PI
  livingRear.userData.elevation = 'rear'
  house.add(livingRear)

  const rvW = garageW * (sideEntry ? 0.52 : 0.4)
  const dblW = garageW * (sideEntry ? 0.44 : 0.52)
  const rvX = garageX + garageW / 2 - rvW / 2 - 0.1
  const dblX = garageX - garageW / 2 + dblW / 2 + 0.08

  addStreetGable(house, rvW + 0.35, garageDepth, garageH, rise * 0.7, rvX, garageZ, siding, roof, fascia)
  addStreetGable(
    house,
    dblW + 0.3,
    garageDepth * (sideEntry ? 0.98 : 0.9),
    wallH + 0.15,
    rise * 0.62,
    dblX,
    garageZ + 0.1,
    siding,
    roof,
    fascia
  )

  const rvH = garageH * 0.74
  addGarageDoor(house, rvW * 0.86, rvH, rvX, garageFrontZ + 0.06, doorWhite, trim, 'front')

  const dblH = wallH * 0.68
  if (sideEntry) {
    const sideX = garageX + garageW / 2 + 0.06
    addGarageDoor(house, dblW * 1.25, dblH, sideX, garageZ, doorWhite, trim, 'side')
    addWindow(house, dblW * 0.42, 1.15, dblX, wallH * 0.55, garageFrontZ + 0.04, glass, trim)
    addDoorNode(house, 'GarageDoorFront', rvX, garageFrontZ)
    addDoorNode(house, 'GarageDoorSide', sideX + 0.2, garageZ)
    house.userData.garageLocalX = sideX + 0.2
    house.userData.garageLocalZ = garageZ
    addBox(house, 1.0, 0.05, dblW * 1.35, concrete, sideX - 0.35, 0.025, garageZ)
  } else {
    addGarageDoor(house, dblW * 0.88, dblH, dblX, garageFrontZ + 0.08, doorWhite, trim, 'front')
    addWindow(house, 0.42, 0.95, dblX, wallH + rise * 0.18, garageFrontZ + 0.04, glass, trim)
    addDoorNode(house, 'GarageDoorFront', (rvX + dblX) / 2, garageFrontZ)
    addBox(house, garageW * 0.92, 0.05, 0.7, concrete, garageX, 0.025, garageFrontZ - 0.28)
  }

  const porchD = 2.8
  const porchZ = -D / 2 + porchD / 2 + 0.15
  addBox(house, entryW * 0.9, 0.14, porchD, concrete, entryX, 0.07, porchZ)
  const postH = wallH * 0.9
  for (const px of [entryX - entryW * 0.28, entryX + entryW * 0.28]) {
    addBox(house, 0.26, postH, 0.26, wood, px, postH / 2, -D / 2 + 0.38)
  }
  addStreetGable(house, entryW * 0.78, porchD * 0.5, wallH * 0.98, rise * 0.48, entryX, porchZ - 0.1, siding, roof, fascia)
  addBox(house, entryW * 0.62, 0.14, 0.18, wood, entryX, wallH * 0.86, -D / 2 + 0.5)
  const braceL = addBox(house, 0.1, 1.1, 0.1, wood, entryX - entryW * 0.15, wallH * 0.52, -D / 2 + 0.5)
  braceL.rotation.z = 0.52
  const braceR = addBox(house, 0.1, 1.1, 0.1, wood, entryX + entryW * 0.15, wallH * 0.52, -D / 2 + 0.5)
  braceR.rotation.z = -0.52
  addBox(house, 1.65, 2.35, 0.1, doorBlack, entryX, 1.25, -D / 2 + 0.18)
  addBox(house, 0.5, 1.7, 0.04, glass, entryX - 0.36, 1.32, -D / 2 + 0.12)
  addBox(house, 0.5, 1.7, 0.04, glass, entryX + 0.36, 1.32, -D / 2 + 0.12)

  const winZ = -D / 2 + 0.04
  addWindow(house, 1.0, 1.55, livingX + livingW * 0.2, 1.7, winZ, glass, trim)
  addWindow(house, 1.8, 1.45, livingX - livingW * 0.1, 1.7, winZ, glass, trim, shutter)
  addWindow(house, 1.8, 1.45, livingX - livingW * 0.36, 1.7, winZ, glass, trim, shutter)
  addStreetGable(
    house,
    livingW * 0.42,
    D * 0.18,
    wallH * 1.0,
    rise * 0.5,
    livingX - livingW * 0.05,
    -D / 2 + D * 0.12,
    siding,
    roof,
    fascia
  )

  const rearCenterX = entryX - entryW * 0.06
  const rearW = (livingW + entryW) * 0.55
  const rearD = D * 0.24
  addStreetGable(house, rearW, rearD, wallH * 1.04, rise * 0.85, rearCenterX, D / 2 - rearD / 2, siding, roof, fascia)
  const faceZ = D / 2 - 0.04
  const glassW = rearW * 0.72
  const glassH = wallH * 0.88
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const cellW = glassW / 3
      const cellH = glassH / 2
      addWindow(
        house,
        cellW * 0.82,
        cellH * 0.78,
        rearCenterX + (c - 1) * cellW,
        0.45 + cellH / 2 + r * cellH,
        faceZ,
        glass,
        trim
      )
    }
  }
  addBox(house, 0.28, wallH * 0.92, 0.28, wood, rearCenterX - glassW / 2 - 0.18, wallH * 0.46, faceZ - 0.06)
  addBox(house, 0.28, wallH * 0.92, 0.28, wood, rearCenterX + glassW / 2 + 0.18, wallH * 0.46, faceZ - 0.06)

  return finishHouse(house, W, D)
}

function buildBrownstone(): THREE.Group {
  const W = 91 * FT_TO_M
  const D = 72 * FT_TO_M
  const wallH = 3.25
  const garageH = 4.45
  const rise = 2.35

  const siding = mat(0xe8e0d4, 0.9, sidingMap('#e8e0d4', false))
  const roof = mat(0xffffff, 0.96, shingleMap())
  const stone = mat(0x8a8070, 0.92)
  const trim = mat(0x5c5348, 0.7)
  const fascia = mat(0xe4dccf, 0.82)
  const woodDoor = mat(0xc4a574, 0.65)
  const shutter = mat(0xb8b3a8, 0.8)
  const glass = new THREE.MeshStandardMaterial({
    color: 0x5a7384,
    roughness: 0.14,
    metalness: 0.4,
    transparent: true,
    opacity: 0.8,
  })
  const concrete = mat(0xc4bfb4, 0.95)

  const house = new THREE.Group()
  house.name = 'house-brownstone'
  house.userData.planId = 'brownstone'
  house.userData.garageEntry = 'front'

  // Marketing elevation: garage on viewer-right = local −x
  const garageW = W * 0.38
  const mainW = W - garageW
  const garageX = -W / 2 + garageW / 2
  const mainX = W / 2 - mainW / 2
  const garageDepth = D * 0.78
  const garageFrontZ = -D / 2
  const garageZ = garageFrontZ + garageDepth / 2

  addSideGable(house, mainW * 0.98, D * 0.92, wallH, rise, mainX, 0.04, siding, roof, fascia)
  addBox(house, W * 0.98, 0.42, D * 0.96, stone, 0, 0.21, 0)

  addStreetGable(house, garageW * 0.92, garageDepth, garageH, rise * 0.72, garageX, garageZ, siding, roof, fascia)
  const doorW = garageW * 0.62
  const doorH = garageH * 0.7
  addGarageDoor(house, doorW, doorH, garageX, garageFrontZ + 0.06, woodDoor, trim, 'front')
  addDoorNode(house, 'GarageDoorFront', garageX, garageFrontZ)
  addBox(house, garageW * 0.85, 0.05, 0.7, concrete, garageX, 0.025, garageFrontZ - 0.28)

  addStreetGable(house, mainW * 0.28, D * 0.22, wallH * 1.05, rise * 0.7, mainX + mainW * 0.08, -D / 2 + D * 0.14, siding, roof, fascia)
  addStreetGable(house, mainW * 0.22, D * 0.18, wallH * 1.02, rise * 0.55, mainX - mainW * 0.22, -D / 2 + D * 0.12, siding, roof, fascia)

  const winZ = -D / 2 + 0.05
  addWindow(house, 1.7, 2.1, mainX + mainW * 0.08, 1.85, winZ, glass, trim, shutter)
  addWindow(house, 1.7, 2.1, mainX - mainW * 0.18, 1.85, winZ, glass, trim, shutter)
  addBox(house, 1.25, 2.45, 0.12, trim, mainX - mainW * 0.02, 1.3, winZ + 0.08)
  addBox(house, 1.05, 2.2, 0.06, mat(0x3a3530, 0.7), mainX - mainW * 0.02, 1.22, winZ + 0.02)

  return finishHouse(house, W, D)
}

/** Build a brief-compliant 3D home for Lot Studio. */
export function buildBuilderHome(planId: string): THREE.Group {
  if (planId === 'whitestone-side') return buildWhitestone(true)
  if (planId === 'whitestone-front' || planId === 'whitestone') return buildWhitestone(false)
  return buildBrownstone()
}

/**
 * Stamp photoreal elevations onto front/rear wall faces using house-local
 * planar UVs. Alpha is ignored so walls stay solid (no card-shaped holes).
 */
export function applyBuilderElevations(
  house: THREE.Group,
  front: THREE.Texture,
  rear?: THREE.Texture | null
): void {
  const W = house.userData.widthM as number
  const img = front.image as { width: number; height: number } | undefined
  const elevH = img?.width && img.height ? W / (img.width / img.height) : 8.4
  house.userData.facadeHeightM = elevH

  const prep = (tex: THREE.Texture) => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.premultiplyAlpha = false
  }
  prep(front)
  if (rear) prep(rear)

  const D = house.userData.depthM as number
  const bindSheet = (
    name: string,
    tex: THREE.Texture | null | undefined,
    faceStreet: boolean
  ) => {
    const sheet = house.getObjectByName(name) as THREE.Mesh | undefined
    if (!sheet || !tex) return
    const material = sheet.material as THREE.MeshStandardMaterial
    material.map = tex
    material.transparent = true
    material.alphaTest = 0.38
    material.depthWrite = true
    material.needsUpdate = true
    sheet.visible = true
    sheet.scale.set(W, elevH, 1)
    sheet.position.set(0, elevH / 2, faceStreet ? -D / 2 - 0.04 : D / 2 + 0.04)
    if (faceStreet) sheet.rotation.y = Math.PI
  }
  bindSheet('frontElevationSheet', front, true)
  bindSheet('rearElevationSheet', rear, false)

  house.updateMatrixWorld(true)
  const v = new THREE.Vector3()

  house.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const which = mesh.userData.elevation as 'front' | 'rear' | undefined
    if (!which) return
    const tex = which === 'front' ? front : rear
    if (!tex) return

    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    mesh.geometry = geo
    const pos = geo.attributes.position
    const uvs = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      mesh.localToWorld(v)
      house.worldToLocal(v)
      // Image-left = viewer-left = local +x
      uvs[i * 2] = THREE.MathUtils.clamp((W / 2 - v.x) / W, 0, 1)
      uvs[i * 2 + 1] = THREE.MathUtils.clamp(v.y / elevH, 0, 1)
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

    const base = mesh.material as THREE.MeshStandardMaterial
    const stamped = base.clone()
    stamped.map = tex
    stamped.color.set(0xffffff)
    stamped.transparent = false
    stamped.alphaTest = 0
    stamped.roughness = 0.7
    stamped.needsUpdate = true
    mesh.material = stamped
  })

  house.userData.hasPhotorealSkins = true
}
