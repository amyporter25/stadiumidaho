import * as THREE from 'three'
import { FT_TO_M } from './geo'
import { getPlan } from '../../data/plans'

/**
 * Recognizable 3D massings for Blackstone plans.
 *
 * Volume comes from footprint + garage layout; street-side realism comes from
 * the builder elevation drawing draped on the front facade. Not a BIM model —
 * buyers should read scale, garage entry, and "that's the Whitestone."
 *
 * Origin = footprint center at ground; front faces −z.
 */

type GarageEntry = 'front' | 'side'

interface HouseSpec {
  widthFt: number
  depthFt: number
  wallM: number
  roofRiseM: number
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
    garageWing: 'left',
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
    depthFt: 70,
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
    depthFt: 70,
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

export function buildHouse(planId: string): THREE.Group {
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
  house.userData.garageHeightM = spec.garageHeightM

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

  // Front porch
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
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.7, 0.08),
      trim
    )
    frame.position.set(wx, 1.75, frontZ)
    house.add(frame)
    const win = new THREE.Mesh(winGeo, glass)
    win.position.set(wx, 1.75, frontZ - 0.04)
    house.add(win)
  }

  // Facade billboard — builder elevation drawing, slightly in front of the massing
  const facadeH = Math.max(spec.wallM, spec.garageHeightM) * 1.05 + spec.roofRiseM * 0.55
  const facade = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.98, facadeH),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.75,
      metalness: 0.02,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.FrontSide,
    })
  )
  facade.name = 'elevationFacade'
  facade.position.set(0, facadeH * 0.48, -D * 0.5 - 0.12)
  facade.visible = false
  house.add(facade)

  // Driveway apron attach point (local space) — used by Studio driveway sim
  const approach = new THREE.Object3D()
  approach.name = 'garageApproach'
  if (spec.garageEntry === 'side') {
    const sideX = garageOnLeft
      ? garageX - garageW / 2 - 1.2
      : garageX + garageW / 2 + 1.2
    approach.position.set(sideX, 0, -D * 0.02)
  } else {
    approach.position.set(garageX, 0, garageFrontZ - 1.0)
  }
  house.add(approach)

  house.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  facade.castShadow = false

  return house
}

/** Drape the builder elevation PNG onto the front facade plane. */
export function applyElevationFacade(
  house: THREE.Group,
  facadeUrl: string
): Promise<void> {
  const facade = house.getObjectByName('elevationFacade') as THREE.Mesh | undefined
  if (!facade) return Promise.resolve()

  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      facadeUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 8
        const mat = facade.material as THREE.MeshStandardMaterial
        mat.map?.dispose()
        mat.map = tex
        mat.opacity = 1
        mat.transparent = true
        mat.needsUpdate = true
        facade.visible = true
        // Match plane aspect to image so the elevation isn't stretched
        const img = tex.image as HTMLImageElement
        const aspect = img.width / Math.max(1, img.height)
        const h = (facade.geometry as THREE.PlaneGeometry).parameters.height
        const w = h * aspect
        const maxW = (house.userData.widthM as number) * 1.02
        const finalW = Math.min(w, maxW)
        const finalH = finalW / aspect
        facade.geometry.dispose()
        facade.geometry = new THREE.PlaneGeometry(finalW, finalH)
        facade.position.y = finalH * 0.48
        resolve()
      },
      undefined,
      () => resolve()
    )
  })
}

export function houseFootprint(planId: string): { wM: number; dM: number } {
  const spec = resolveSpec(planId)
  return { wM: spec.widthFt * FT_TO_M, dM: spec.depthFt * FT_TO_M }
}

/** Facade image URL for a plan (PNG with paper knocked out when available). */
export function planFacadeUrl(planId: string): string | null {
  const plan = getPlan(planId)
  return plan?.facadeImg ?? plan?.elevationImg ?? null
}
