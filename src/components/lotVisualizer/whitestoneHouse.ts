import * as THREE from 'three'
import { FT_TO_M } from './geo'

/**
 * Whitestone Lot Studio house:
 * 1) Solid 3D massing (orbit depth, sides, roofs)
 * 2) Front/rear SILHOUETTE cutouts — transparent outside the house outline
 *    so there is no rectangular photo "card" / square border
 *
 * Street = −z. RV + two-car garage on the left.
 */

const W_FT = 94
const D_FT = 58

export const WHITESTONE_FRONT_SKIN = '/plans/refs/whitestone-front.png?v=sil1'
export const WHITESTONE_REAR_SKIN = '/plans/refs/whitestone-rear.png?v=sil1'

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
  for (let y = 0; y < 256; y += 9) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y)
    ctx.stroke()
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

function gableRoof(spanRidge: number, spanAcross: number, rise: number, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape()
  const hw = spanAcross / 2
  shape.moveTo(-hw, 0)
  shape.lineTo(hw, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: spanRidge, bevelEnabled: false })
  geo.translate(0, 0, -spanRidge / 2)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.y = Math.PI / 2
  return mesh
}

function box(
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
  return m
}

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

  const garageW = W * 0.4
  const entryW = W * 0.2
  const livingW = W - garageW - entryW
  const garageX = -W / 2 + garageW / 2
  const entryX = -W / 2 + garageW + entryW / 2
  const livingX = W / 2 - livingW / 2

  const garageDepth = D * 0.9
  const garageFrontZ = -D / 2
  const garageCenterZ = garageFrontZ + garageDepth / 2

  // Solid massing (visible from sides / under cutouts)
  house.add(
    box(livingW + entryW * 0.35, wallH, D, siding, (entryX + livingX) / 2 + livingW * 0.05, wallH / 2, 0)
  )
  house.add(box(garageW, garageH, garageDepth, siding, garageX, garageH / 2, garageCenterZ))

  const mainRoof = gableRoof(livingW + entryW * 0.5 + 0.4, D + 0.4, roofRise, roofMat)
  mainRoof.position.set((entryX + livingX) / 2 + livingW * 0.05, wallH, 0)
  house.add(mainRoof)

  const garageRoof = gableRoof(garageDepth + 0.3, garageW + 0.3, roofRise * 0.7, roofMat)
  garageRoof.position.set(garageX, garageH, garageCenterZ)
  house.add(garageRoof)

  // Garage doors + entry + windows (massing detail when cutouts haven't loaded / from side)
  const rvW = garageW * 0.38
  const dblW = garageW * 0.5
  const rvX = garageX - garageW / 2 + rvW / 2 + 0.2
  const dblX = garageX + garageW / 2 - dblW / 2 - 0.15
  const doorZ = garageFrontZ + 0.08
  const rvH = garageH * 0.78
  const dblH = wallH * 0.72
  house.add(box(rvW * 0.9, rvH, 0.1, doorWhite, rvX, rvH / 2, doorZ))
  house.add(box(dblW * 0.92, dblH, 0.1, doorWhite, dblX, dblH / 2, doorZ + 0.25))

  const porchDepth = 2.8
  const porchZ = -D / 2 + porchDepth / 2 + 0.15
  house.add(box(entryW * 0.9, 0.14, porchDepth, concrete, entryX, 0.07, porchZ))
  for (const px of [entryX - entryW * 0.28, entryX + entryW * 0.28]) {
    house.add(box(0.26, wallH * 0.9, 0.26, wood, px, (wallH * 0.9) / 2, -D / 2 + 0.35))
  }
  house.add(box(entryW * 0.75, wallH * 0.95, 0.25, siding, entryX, (wallH * 0.95) / 2, porchZ - 0.15))
  house.add(box(1.65, 2.35, 0.1, doorBlack, entryX, 1.25, -D / 2 + 0.2))

  for (const [wx, ww, wh] of [
    [livingX - livingW * 0.2, 1.1, 1.55],
    [livingX + livingW * 0.18, 1.9, 1.45],
  ] as const) {
    house.add(box(ww + 0.12, wh + 0.12, 0.08, trim, wx, 1.65, -D / 2 + 0.12))
    house.add(
      box(
        ww,
        wh,
        0.05,
        glass,
        wx,
        1.65,
        -D / 2 + 0.07
      )
    )
  }

  // Rear glass gable (joined)
  const rearZ = D / 2
  const rearGableW = (livingW + entryW) * 0.55
  const rearGableDepth = D * 0.22
  house.add(
    box(
      rearGableW,
      wallH * 1.05,
      rearGableDepth,
      siding,
      entryX + entryW * 0.05,
      (wallH * 1.05) / 2,
      rearZ - rearGableDepth / 2
    )
  )
  const rearRoof = gableRoof(rearGableDepth + 0.25, rearGableW + 0.25, roofRise * 0.85, roofMat)
  rearRoof.position.set(entryX + entryW * 0.05, wallH * 1.05, rearZ - rearGableDepth / 2)
  house.add(rearRoof)
  const glassW = rearGableW * 0.72
  const faceZ = rearZ - 0.06
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const cellW = glassW / 3
      const cellH = (wallH * 0.9) / 2
      const gx = entryX + entryW * 0.05 + (c - 1) * cellW
      const gy = 0.45 + cellH / 2 + r * cellH
      house.add(box(cellW * 0.92, cellH * 0.92, 0.08, trim, gx, gy, faceZ))
      house.add(box(cellW * 0.8, cellH * 0.8, 0.05, glass, gx, gy, faceZ + 0.05))
    }
  }

  // Silhouette elevation cutouts — hidden until textures load.
  // These are house-shaped (alpha), NOT opaque rectangles.
  const elevH = garageH + roofRise * 0.55
  house.userData.facadeHeightM = elevH
  house.add(makeSilhouettePlane('streetFacade', W, elevH, -D / 2 - 0.04, true))
  house.add(makeSilhouettePlane('rearFacade', W, elevH, D / 2 + 0.04, false))

  const approach = new THREE.Object3D()
  approach.name = 'garageApproach'
  approach.position.set((rvX + dblX) / 2, 0, garageFrontZ)
  house.add(approach)

  house.add(box(garageW * 0.92, 0.05, 0.75, concrete, garageX, 0.025, garageFrontZ - 0.35))

  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  return house
}

/** Transparent-ready plane; alpha cutout removes any rectangular card edge. */
function makeSilhouettePlane(
  name: string,
  widthM: number,
  heightM: number,
  z: number,
  faceStreet: boolean
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.45,
    depthWrite: true,
    side: THREE.FrontSide,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  mesh.name = name
  mesh.userData.isStreetFacade = faceStreet
  mesh.userData.isElevationSkin = true
  mesh.visible = false
  mesh.renderOrder = 4
  mesh.scale.set(widthM, heightM, 1)
  if (faceStreet) mesh.rotation.y = Math.PI
  mesh.position.set(0, heightM / 2, z)
  return mesh
}

/**
 * Apply house-shaped cutouts. Transparent pixels = no square border.
 * Aspect-correct width lock; bottom sits on the ground plane.
 */
export function applyWhitestoneSkins(
  house: THREE.Group,
  front: THREE.Texture,
  rear?: THREE.Texture | null
): void {
  const W = house.userData.widthM as number
  const D = house.userData.depthM as number

  const apply = (mesh: THREE.Mesh | undefined, tex: THREE.Texture | null | undefined, z: number) => {
    if (!mesh || !tex) return
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.repeat.set(1, 1)
    tex.offset.set(0, 0)
    tex.anisotropy = 8
    tex.premultiplyAlpha = false
    tex.needsUpdate = true

    const m = mesh.material as THREE.MeshBasicMaterial
    m.map?.dispose()
    m.map = tex
    m.color.set(0xffffff)
    m.transparent = true
    m.alphaTest = 0.45
    m.depthWrite = true
    m.needsUpdate = true

    const img = tex.image as { width?: number; height?: number } | undefined
    if (img?.width && img.height) {
      const h = W / (img.width / img.height)
      mesh.scale.set(W, h, 1)
      mesh.position.set(0, h / 2, z)
      house.userData.facadeHeightM = h
    }
    mesh.visible = true
  }

  apply(house.getObjectByName('streetFacade') as THREE.Mesh | undefined, front, -D / 2 - 0.04)
  apply(house.getObjectByName('rearFacade') as THREE.Mesh | undefined, rear ?? null, D / 2 + 0.04)

  // Hide shallow street/rear props that would double under the cutouts
  hideUnderCutouts(house)
  house.userData.hasPhotorealSkins = true
}

function hideUnderCutouts(house: THREE.Group): void {
  house.updateMatrixWorld(true)
  const origin = new THREE.Vector3()
  house.getWorldPosition(origin)
  const q = new THREE.Quaternion()
  house.getWorldQuaternion(q)
  const inv = q.clone().invert()
  const tmp = new THREE.Vector3()
  const D = house.userData.depthM as number

  house.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return
    const n = o.name
    if (n === 'streetFacade' || n === 'rearFacade' || n === 'garageApproach') return
    o.getWorldPosition(tmp)
    const local = tmp.clone().sub(origin).applyQuaternion(inv)
    const geo = (o as THREE.Mesh).geometry
    if (!geo.boundingBox) geo.computeBoundingBox()
    const bb = geo.boundingBox
    if (!bb) return
    const depth = bb.max.z - bb.min.z
    // Thin facade props near street or rear — cutouts replace them
    if (depth < 0.5 && (local.z < -D * 0.35 || local.z > D * 0.35)) {
      o.visible = false
    }
  })
}

export const whitestoneFootprintFt = { width: W_FT, depth: D_FT }
export const whitestoneFootprintM = {
  wM: W_FT * FT_TO_M,
  dM: D_FT * FT_TO_M,
}
export const whitestoneGarageXFrac = -0.28
