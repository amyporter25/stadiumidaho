import * as THREE from 'three'
import { FT_TO_M } from './geo'
import { getPlan } from '../../data/plans'
import { buildWhitestoneHouse } from './whitestoneHouse'

/**
 * Recognizable 3D massings for Blackstone plans.
 *
 * Volume comes from the construction-plan footprint + garage layout.
 * In Lot Studio, the photoreal marketing elevation is applied on the street
 * face so the home reads as the real render from the curb and as a solid
 * volume when you orbit. Not a full BIM walk-around.
 *
 * Origin = footprint center at ground; front faces −z.
 */

type GarageEntry = 'front' | 'side'

export interface BuildHouseOptions {
  /**
   * When true, skip procedural porch/windows/garage-door boxes so a photoreal
   * front facade can sit on the street face without fighting the massing.
   */
  facadeMode?: boolean
}

interface HouseSpec {
  widthFt: number
  depthFt: number
  wallM: number
  roofRiseM: number
  /** Garage wing side for the procedural massing (Whitestone uses its own builder). */
  garageWing: 'right' | 'left' | 'none'
  garageEntry: GarageEntry
  garageWidthFrac: number
  garageHeightM: number
  porchDepthM: number
  siding: number
  roof: number
  trim: number
  stone?: number
  /** Prefer board-and-batten vertical siding look */
  boardBatten?: boolean
}

const SPECS: Record<string, HouseSpec> = {
  brownstone: {
    widthFt: 91,
    depthFt: 72,
    wallM: 3.4,
    roofRiseM: 2.6,
    // Marketing elevation: RV bay on the viewer's right
    garageWing: 'right',
    garageEntry: 'front',
    garageWidthFrac: 0.4,
    garageHeightM: 4.6,
    porchDepthM: 4.0,
    siding: 0xd4cfc0,
    roof: 0x6b6357,
    trim: 0xb59a6d,
    stone: 0x8a8070,
  },
  'whitestone-front': {
    widthFt: 94,
    depthFt: 58,
    wallM: 3.2,
    roofRiseM: 2.9,
    // ArchyBase / builder refs: tall RV + two-car on the street-left
    garageWing: 'left',
    garageEntry: 'front',
    garageWidthFrac: 0.42,
    garageHeightM: 4.6,
    porchDepthM: 3.0,
    siding: 0xf2efe6,
    roof: 0x2a2a28,
    trim: 0x9c7b52,
    boardBatten: true,
  },
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
    siding: 0xf2efe6,
    roof: 0x2a2a28,
    trim: 0x9c7b52,
    boardBatten: true,
  },
  whitestone: {
    widthFt: 94,
    depthFt: 58,
    wallM: 3.2,
    roofRiseM: 2.9,
    garageWing: 'left',
    garageEntry: 'front',
    garageWidthFrac: 0.42,
    garageHeightM: 4.6,
    porchDepthM: 3.0,
    siding: 0xf2efe6,
    roof: 0x2a2a28,
    trim: 0x9c7b52,
    boardBatten: true,
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

const textureCache = new Map<string, THREE.CanvasTexture>()

function makeSidingTexture(base: string, boardBatten: boolean): THREE.CanvasTexture {
  const key = `siding-${base}-${boardBatten}`
  const hit = textureCache.get(key)
  if (hit) return hit

  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)

  if (boardBatten) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    for (let x = 0; x < 256; x += 18) {
      ctx.fillRect(x, 0, 3, 256)
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    for (let x = 3; x < 256; x += 18) {
      ctx.fillRect(x, 0, 1, 256)
    }
  } else {
    // subtle stucco noise
    for (let i = 0; i < 2200; i++) {
      const a = 0.04 + Math.random() * 0.06
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 3)
  tex.colorSpace = THREE.SRGBColorSpace
  textureCache.set(key, tex)
  return tex
}

function makeRoofTexture(base: string): THREE.CanvasTexture {
  const key = `roof-${base}`
  const hit = textureCache.get(key)
  if (hit) return hit

  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 1
  for (let y = 0; y < 256; y += 10) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(256, y)
    ctx.stroke()
    const offset = (y / 10) % 2 === 0 ? 0 : 12
    for (let x = offset; x < 256; x += 24) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y + 10)
      ctx.stroke()
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(6, 4)
  tex.colorSpace = THREE.SRGBColorSpace
  textureCache.set(key, tex)
  return tex
}

function hexCss(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`
}

function wallMat(spec: HouseSpec): THREE.MeshStandardMaterial {
  const map = makeSidingTexture(hexCss(spec.siding), !!spec.boardBatten)
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
  })
}

function roofMat(spec: HouseSpec): THREE.MeshStandardMaterial {
  const map = makeRoofTexture(hexCss(spec.roof))
  return new THREE.MeshStandardMaterial({
    map,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.04,
  })
}

function solidMat(color: number, roughness = 0.85): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 })
}

function gabledBlock(
  w: number,
  d: number,
  wallH: number,
  roofRise: number,
  wall: THREE.Material,
  roof: THREE.Material,
  overhang = 0.45
): THREE.Group {
  const g = new THREE.Group()

  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wall)
  walls.position.y = wallH / 2
  walls.castShadow = true
  walls.receiveShadow = true
  g.add(walls)

  // Slight stone water-table band
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.04, 0.35, d + 0.04),
    solidMat(0x7a7368, 0.95)
  )
  band.position.y = 0.18
  band.castShadow = true
  g.add(band)

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
  const roofMesh = new THREE.Mesh(roofGeo, roof)
  roofMesh.position.y = wallH
  roofMesh.castShadow = true
  roofMesh.receiveShadow = true
  g.add(roofMesh)

  return g
}

function gabledBlockZ(
  w: number,
  d: number,
  wallH: number,
  roofRise: number,
  wall: THREE.Material,
  roof: THREE.Material,
  overhang = 0.45
): THREE.Group {
  const g = gabledBlock(d, w, wallH, roofRise, wall, roof, overhang)
  g.rotation.y = Math.PI / 2
  return g
}

function resolveSpec(planId: string): HouseSpec {
  return SPECS[planId] ?? SPECS.brownstone
}

function isWhitestoneFront(planId: string): boolean {
  return planId === 'whitestone-front' || planId === 'whitestone'
}

export function buildHouse(planId: string, opts: BuildHouseOptions = {}): THREE.Group {
  // Dedicated Whitestone exterior from front/rear + dollhouse refs
  if (isWhitestoneFront(planId)) {
    return buildWhitestoneHouse()
  }

  const facadeMode = !!opts.facadeMode
  const spec = resolveSpec(planId)
  const W = spec.widthFt * FT_TO_M
  const D = spec.depthFt * FT_TO_M

  const siding = wallMat(spec)
  const roof = roofMat(spec)
  const trim = solidMat(spec.trim, 0.75)
  const doorMat = solidMat(0x3a3530, 0.8)
  const glass = new THREE.MeshStandardMaterial({
    color: 0x6a8496,
    roughness: 0.15,
    metalness: 0.55,
    transparent: true,
    opacity: 0.85,
  })

  const house = new THREE.Group()
  house.name = `house-${planId}`
  house.userData.planId = planId
  house.userData.widthM = W
  house.userData.depthM = D
  house.userData.wallM = spec.wallM
  house.userData.roofRiseM = spec.roofRiseM
  house.userData.garageHeightM = spec.garageHeightM
  house.userData.facadeMode = facadeMode

  const garageW = W * spec.garageWidthFrac
  const mainW = W - garageW
  const garageOnLeft = spec.garageWing === 'left'
  const mainX = garageOnLeft ? -W / 2 + garageW + mainW / 2 : -W / 2 + mainW / 2
  const garageX = garageOnLeft ? -W / 2 + garageW / 2 : W / 2 - garageW / 2
  const garageDepth = D * (spec.garageEntry === 'side' ? 0.88 : 0.8)
  const garageFrontZ = -D * 0.02 - garageDepth / 2

  const main = gabledBlockZ(mainW, D * 0.92, spec.wallM, spec.roofRiseM, siding, roof)
  main.position.set(mainX, 0, D * 0.02)
  house.add(main)

  // Secondary forward gable over the entry (reads more like the elevation)
  const entryGable = gabledBlockZ(
    mainW * 0.32,
    D * 0.28,
    spec.wallM * 1.05,
    spec.roofRiseM * 0.7,
    siding,
    roof,
    0.25
  )
  entryGable.position.set(mainX, 0, -D * 0.28)
  house.add(entryGable)

  if (spec.garageWing !== 'none') {
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

    // Procedural door boxes only when there is no photoreal facade in front
    if (!facadeMode) {
      if (spec.garageEntry === 'front') {
        const rvW = garageW * 0.38
        const dblW = garageW * 0.48
        const doorH = spec.garageHeightM * 0.72
        const rv = new THREE.Mesh(new THREE.BoxGeometry(rvW, doorH * 1.15, 0.14), doorMat)
        const dbl = new THREE.Mesh(new THREE.BoxGeometry(dblW, doorH, 0.14), doorMat)
        const gap = 0.25
        const pairW = rvW + dblW + gap
        const startX = garageX - pairW / 2
        rv.position.set(startX + rvW / 2, doorH * 1.15 * 0.5, garageFrontZ - 0.08)
        dbl.position.set(startX + rvW + gap + dblW / 2, doorH * 0.5, garageFrontZ - 0.08)
        const rvPanel = new THREE.Mesh(
          new THREE.PlaneGeometry(rvW * 0.9, doorH * 1.15 * 0.9),
          solidMat(0x2e2a26, 0.9)
        )
        rvPanel.position.z = -0.08
        rv.add(rvPanel)
        const dblPanel = new THREE.Mesh(
          new THREE.PlaneGeometry(dblW * 0.9, doorH * 0.9),
          solidMat(0x2e2a26, 0.9)
        )
        dblPanel.position.z = -0.08
        dbl.add(dblPanel)
        house.add(rv, dbl)
      } else {
        const rvW = garageW * 0.55
        const rvH = spec.garageHeightM * 0.82
        const rv = new THREE.Mesh(new THREE.BoxGeometry(rvW, rvH, 0.14), doorMat)
        rv.position.set(garageX, rvH * 0.5, garageFrontZ - 0.08)
        house.add(rv)

        const sideDoorW = garageDepth * 0.55
        const sideDoorH = spec.garageHeightM * 0.62
        const sideDoor = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, sideDoorH, sideDoorW),
          doorMat
        )
        const sideX = garageOnLeft
          ? garageX - garageW / 2 - 0.08
          : garageX + garageW / 2 + 0.08
        sideDoor.position.set(sideX, sideDoorH * 0.5, -D * 0.02)
        house.add(sideDoor)
      }
    }
  }

  if (!facadeMode) {
    // Front porch + fenestration (massing-only path / LotVisualizer)
    const porchW = mainW * 0.48
    const porch = new THREE.Group()
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(porchW, 0.18, spec.porchDepthM),
      solidMat(0xb8b0a2, 0.9)
    )
    slab.position.y = 0.09
    porch.add(slab)
    const shedRoof = new THREE.Mesh(
      new THREE.BoxGeometry(porchW + 0.2, 0.12, spec.porchDepthM + 0.15),
      roof
    )
    shedRoof.position.y = spec.wallM * 0.9
    shedRoof.rotation.x = -0.14
    porch.add(shedRoof)
    for (const px of [-porchW / 2 + 0.25, porchW / 2 - 0.25]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, spec.wallM * 0.86, 0.18),
        trim
      )
      post.position.set(px, (spec.wallM * 0.86) / 2, -spec.porchDepthM / 2 + 0.25)
      porch.add(post)
    }
    porch.position.set(mainX, 0, -D * 0.44 - spec.porchDepthM / 2 + 0.2)
    house.add(porch)

    const frontDoor = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.35, 0.12), trim)
    frontDoor.position.set(mainX, 1.18, -D * 0.44 - 0.05)
    house.add(frontDoor)

    const winGeo = new THREE.BoxGeometry(1.35, 1.55, 0.1)
    const frontZ = -D * 0.46
    const winXs = garageOnLeft
      ? [mainX - mainW * 0.22, mainX + mainW * 0.18, mainX + mainW * 0.38]
      : [mainX - mainW * 0.38, mainX - mainW * 0.18, mainX + mainW * 0.22]
    for (const wx of winXs) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.08), trim)
      frame.position.set(wx, 1.75, frontZ)
      house.add(frame)
      const win = new THREE.Mesh(winGeo, glass)
      win.position.set(wx, 1.75, frontZ - 0.04)
      house.add(win)
    }
  }

  // Driveway apron attach point (local space)
  const approach = new THREE.Object3D()
  approach.name = 'garageApproach'
  if (spec.garageEntry === 'side') {
    const sideX = garageOnLeft
      ? garageX - garageW / 2 - 1.2
      : garageX + garageW / 2 + 1.2
    approach.position.set(sideX, 0, -D * 0.02)
  } else {
    approach.position.set(garageX, 0, garageFrontZ - 0.35)
  }
  house.add(approach)

  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })

  return house
}

/**
 * Studio house: plan footprint massing.
 * Whitestone is pure 3D (no front/back photo billboards). Other plans may
 * still get a street-facade plane for a marketing elevation cutout.
 */
export function buildStudioHouse(planId: string): THREE.Group {
  const house = buildHouse(planId, { facadeMode: true })

  // Whitestone already has a full 3D exterior — never add a photo card
  if (isWhitestoneFront(planId)) {
    return house
  }

  if (house.getObjectByName('streetFacade')) {
    return house
  }

  const W = house.userData.widthM as number
  const D = house.userData.depthM as number
  const wallM = house.userData.wallM as number
  const roofRiseM = house.userData.roofRiseM as number
  const garageH = house.userData.garageHeightM as number

  // Tall enough for the marketing elevation (garage peak + main roof)
  const facadeH = Math.max(wallM + roofRiseM, garageH + roofRiseM * 0.85) * 1.05
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.35,
    depthWrite: true,
    side: THREE.FrontSide,
  })
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  facade.name = 'streetFacade'
  // Flush with the street face; scale.x = −1 undoes the Y-π mirror so the
  // garage stays on the image-right (matching the 3D wing).
  facade.position.set(0, facadeH / 2, -D / 2 - 0.04)
  facade.rotation.y = Math.PI
  facade.scale.set(-W, facadeH, 1)
  facade.renderOrder = 2
  facade.userData.isStreetFacade = true
  house.add(facade)
  house.userData.facadeHeightM = facadeH

  return house
}

/** Apply a cleaned photoreal cutout to the Studio street facade plane. */
export function applyFacadeTexture(house: THREE.Group, tex: THREE.Texture): void {
  const facade = house.getObjectByName('streetFacade') as THREE.Mesh | undefined
  if (!facade) return
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.premultiplyAlpha = false
  const mat = facade.material as THREE.MeshBasicMaterial
  mat.map?.dispose()
  mat.map = tex
  mat.transparent = true
  // Binary cutouts — higher alphaTest kills fringe/sky leftovers
  mat.alphaTest = 0.35
  mat.needsUpdate = true
  facade.visible = true

  const img = tex.image as HTMLImageElement | undefined
  if (img?.width && img.height) {
    const W = house.userData.widthM as number
    const D = house.userData.depthM as number
    const aspect = img.width / img.height
    const h = W / aspect
    facade.scale.set(-W, h, 1)
    facade.position.set(0, h / 2, -D / 2 - 0.04)
    house.userData.facadeHeightM = h
  }
}

/**
 * Show the photoreal street facade only when the camera is looking at the
 * front of the house — from the side/rear the plan massing reads as solid 3D
 * without a floating photo card.
 */
export function updateFacadeFacing(house: THREE.Group, camera: THREE.Camera): void {
  const facade = house.getObjectByName('streetFacade') as THREE.Mesh | undefined
  if (!facade || !facade.userData.isStreetFacade) return
  house.updateMatrixWorld(true)
  const front = new THREE.Vector3(0, 0, -1).transformDirection(house.matrixWorld)
  const toCam = new THREE.Vector3()
    .subVectors(camera.position, house.getWorldPosition(new THREE.Vector3()))
    .normalize()
  // Fade out as you orbit past ~55° off the street axis
  const facing = front.dot(toCam)
  facade.visible = facing > 0.15
  const mat = facade.material as THREE.MeshBasicMaterial
  mat.opacity = facing > 0.45 ? 1 : Math.max(0, (facing - 0.15) / 0.3)
  mat.transparent = true
}

export function houseFootprint(planId: string): { wM: number; dM: number } {
  const spec = resolveSpec(planId)
  return { wM: spec.widthFt * FT_TO_M, dM: spec.depthFt * FT_TO_M }
}

/** Photoreal cutout URL for Studio placement. */
export function planCutoutUrl(planId: string): string | null {
  const plan = getPlan(planId)
  return plan?.cutoutImg ?? null
}
