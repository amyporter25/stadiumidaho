import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  FT_TO_M,
  frontEdgeMidpoint,
  makeFrame,
  ringToLocal,
  type LocalFrame,
} from '../components/lotVisualizer/geo'
import { aerialUV, loadAerialTexture } from '../components/lotVisualizer/imagery'
import type { StadiumLotFeature } from '../components/LotMap'
import { getPlan } from '../data/plans'
import {
  estimateDriveway,
  type DrivewayEstimate,
  type DrivewayMaterial,
  type PlantKind,
} from './costs'
import { buildPlant } from './landscape'
import { disposeSky, makeClearSky } from './sky'

export type StudioMode = 'look' | 'place' | 'plant'

interface StudioCanvasProps {
  lot: StadiumLotFeature
  neighbors: StadiumLotFeature[]
  mode: StudioMode
  planId: string | null
  houseImageUrl: string | null
  houseWidthFt: number
  houseYawDeg: number
  plantKind: PlantKind
  drivewayMaterial: DrivewayMaterial
  landscapeRevision: number
  onStatus: (msg: string) => void
  onLoadError: (msg: string) => void
  onDrivewayChange: (est: DrivewayEstimate | null) => void
  onLandscapeCostChange: (usd: number, count: number) => void
  onYawSuggest: (deg: number) => void
}

function lotCentroid(lot: StadiumLotFeature): { lat: number; lng: number } {
  const label = lot.properties.label
  if (label) return { lng: label[0], lat: label[1] }
  const ring = lot.geometry!.coordinates[0]
  let lat = 0
  let lng = 0
  for (const [x, y] of ring) {
    lng += x
    lat += y
  }
  return { lat: lat / ring.length, lng: lng / ring.length }
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.isMesh) {
      mesh.geometry?.dispose()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    }
  })
}

function makeAsphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#4a4a4c'
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 40},${40 + Math.random() * 40},${42 + Math.random() * 40},0.35)`
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * Lot-first world: aerial + plat + textured builder home + driveway + landscaping.
 */
export default function StudioCanvas({
  lot,
  neighbors,
  mode,
  planId,
  houseImageUrl,
  houseWidthFt,
  houseYawDeg,
  plantKind,
  drivewayMaterial,
  landscapeRevision,
  onStatus,
  onLoadError,
  onDrivewayChange,
  onLandscapeCostChange,
  onYawSuggest,
}: StudioCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef(mode)
  const plantKindRef = useRef(plantKind)
  const materialRef = useRef(drivewayMaterial)
  const anchorRef = useRef<THREE.Group | null>(null)
  const cutoutRef = useRef<THREE.Mesh | null>(null)
  const approachRef = useRef<THREE.Object3D | null>(null)
  const apronRef = useRef<THREE.Mesh | null>(null)
  const shadowRef = useRef<THREE.Mesh | null>(null)
  const drivewayRef = useRef<THREE.Mesh | null>(null)
  const landscapeRef = useRef<THREE.Group | null>(null)
  const frontMidRef = useRef<[number, number]>([0, 0])
  const groundY = 0.05
  const controlsRef = useRef<OrbitControls | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const widthRef = useRef(houseWidthFt)
  const yawRef = useRef(houseYawDeg)
  const texUrlRef = useRef<string | null>(null)
  const planIdRef = useRef<string | null>(null)
  const frameRef = useRef<LocalFrame | null>(null)
  const syncDrivewayRef = useRef<() => void>(() => {})

  /** Pull the camera down to a street-level view of the house front.
   * Photoreal cutouts only read correctly from this angle — from straight
   * overhead they collapse to a thin edge. */
  const frameHouseStreetView = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const anchor = anchorRef.current
    const cutout = cutoutRef.current
    if (!camera || !controls || !anchor || !cutout?.visible) return

    const yaw = anchor.rotation.y
    // Stand in front of the facade (house front is −z in local space)
    const dist = Math.max(28, cutout.scale.x * 0.85)
    const eyeH = Math.max(4.5, cutout.scale.y * 0.42)
    const lookY = cutout.scale.y * 0.35
    camera.position.set(
      anchor.position.x - Math.sin(yaw) * dist,
      eyeH,
      anchor.position.z - Math.cos(yaw) * dist
    )
    controls.target.set(anchor.position.x, lookY, anchor.position.z)
    controls.update()
  }

  modeRef.current = mode
  plantKindRef.current = plantKind
  materialRef.current = drivewayMaterial
  widthRef.current = houseWidthFt
  yawRef.current = houseYawDeg

  const syncTransform = () => {
    const anchor = anchorRef.current
    if (!anchor || !anchor.visible) return
    anchor.rotation.y = THREE.MathUtils.degToRad(yawRef.current)

    const cutout = cutoutRef.current
    if (cutout?.visible) {
      const w = widthRef.current * FT_TO_M
      const aspect = (cutout.userData.aspect as number) || 1.6
      const h = w / aspect
      cutout.scale.set(w, h, 1)
      cutout.position.y = groundY + h / 2

      const pad = anchor.getObjectByName('footprintPad') as THREE.Mesh | undefined
      if (pad) {
        pad.visible = true
        // Approximate footprint depth from plan catalog when available
        const plan = planIdRef.current ? getPlan(planIdRef.current) : null
        const depthFt = plan?.footprintFt.depth ?? widthRef.current * 0.7
        pad.scale.set(w, depthFt * FT_TO_M, 1)
      }

      // Driveway tip = garage door on the facade. Local −z faces the street;
      // a small +z tuck puts the ribbon under the door so there’s no gap.
      const approach = approachRef.current
      const plan = planIdRef.current ? getPlan(planIdRef.current) : null
      const garageFrac = plan?.garageXFrac ?? 0.35
      const apronDepth = Math.max(5.5, w * 0.14) // ~18–22 ft apron
      if (approach) {
        if (plan?.garageEntry === 'side') {
          // Side-entry: approach the side of the garage wing
          approach.position.set(garageFrac * w - Math.sign(garageFrac || -1) * 1.2, 0, h * 0.02)
        } else {
          approach.position.set(garageFrac * w, 0, 0.35)
        }
      }
      const apron = apronRef.current
      if (apron) {
        const apronW = Math.max(6.5, w * 0.24)
        apron.visible = true
        if (plan?.garageEntry === 'side') {
          apron.scale.set(apronDepth, 1, apronW)
          apron.position.set(
            garageFrac * w - Math.sign(garageFrac || -1) * (apronDepth / 2),
            0.04,
            0
          )
        } else {
          apron.scale.set(apronW, 1, apronDepth)
          // From just under the facade out toward the street (−z)
          apron.position.set(garageFrac * w, 0.04, -apronDepth / 2 + 0.4)
        }
      }
    } else if (apronRef.current) {
      apronRef.current.visible = false
    }

    const shadow = shadowRef.current
    if (shadow && cutout?.visible) {
      shadow.visible = true
      shadow.position.x = anchor.position.x
      shadow.position.z = anchor.position.z
      const span = Math.max(cutout.scale.x, cutout.scale.y) * 0.38
      shadow.scale.set(span, span, 1)
    }

    syncDrivewayRef.current()
  }

  const loadCutoutTexture = (url: string, statusMsg: string, frameView = false) => {
    const mesh = cutoutRef.current
    const anchor = anchorRef.current
    if (!mesh || !anchor) return

    const apply = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      const img = tex.image as HTMLImageElement
      const aspect = img.width / Math.max(1, img.height)
      mesh.userData.aspect = aspect
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.map?.dispose()
      mat.map = tex
      mat.color.set(0xffffff)
      mat.transparent = true
      mat.alphaTest = 0.2
      mat.depthWrite = false
      mat.side = THREE.DoubleSide
      mat.needsUpdate = true
      mesh.visible = true
      anchor.visible = true
      syncTransform()
      if (frameView) frameHouseStreetView()
      onStatus(statusMsg)
    }

    if (texUrlRef.current === url && (mesh.material as THREE.MeshBasicMaterial).map) {
      mesh.visible = true
      anchor.visible = true
      syncTransform()
      if (frameView) frameHouseStreetView()
      onStatus(statusMsg)
      return
    }
    texUrlRef.current = url

    new THREE.TextureLoader().load(
      url,
      (tex) => apply(tex),
      undefined,
      () => onLoadError('Could not load the house image.')
    )
  }

  useEffect(() => {
    syncTransform()
  }, [houseWidthFt, houseYawDeg, drivewayMaterial])

  useEffect(() => {
    if (landscapeRevision === 0) return
    const root = landscapeRef.current
    if (!root) return
    while (root.children.length) {
      const child = root.children[0]
      root.remove(child)
      disposeObject3D(child)
    }
    onLandscapeCostChange(0, 0)
  }, [landscapeRevision, onLandscapeCostChange])

  // Builder plan → photoreal marketing cutout (not procedural boxes / PDF line art)
  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    planIdRef.current = planId

    if (!planId) {
      if (!houseImageUrl) {
        if (cutoutRef.current) cutoutRef.current.visible = false
        anchor.visible = false
        if (shadowRef.current) shadowRef.current.visible = false
        if (drivewayRef.current) drivewayRef.current.visible = false
        onDrivewayChange(null)
      }
      return
    }

    const plan = getPlan(planId)
    if (!plan?.cutoutImg) {
      onLoadError('This plan is missing a house image.')
      return
    }

    // Face the street on drop
    const [fx, fz] = frontMidRef.current
    const yawRad = Math.atan2(
      -(fx - anchor.position.x),
      -(fz - anchor.position.z)
    )
    const yawDeg = Math.round(THREE.MathUtils.radToDeg(yawRad))
    onYawSuggest(yawDeg)
    yawRef.current = yawDeg

    loadCutoutTexture(
      plan.cutoutImg,
      `${plan.name} on the lot — street view of the real elevation. Drag to move; driveway updates with placement.`,
      true
    )
  }, [planId, houseImageUrl, onStatus, onYawSuggest, onDrivewayChange, onLoadError])

  // Custom uploaded photo cutout
  useEffect(() => {
    const anchor = anchorRef.current
    if (!anchor || !houseImageUrl) return
    if (planId) return

    planIdRef.current = null
    loadCutoutTexture(
      houseImageUrl,
      'House photo on the lot — drag to move; driveway follows to the street.'
    )
  }, [houseImageUrl, planId, onStatus, onLoadError])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !lot.geometry) return

    let disposed = false
    let raf = 0
    let renderer: THREE.WebGLRenderer | null = null

    const center = lotCentroid(lot)
    const frame = makeFrame(center.lat, center.lng)
    frameRef.current = frame
    const lotRing = ringToLocal(lot.geometry.coordinates[0], frame)
    const frontMid = frontEdgeMidpoint(lotRing, lot.properties.facing)
    frontMidRef.current = frontMid

    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity
    for (const [x, z] of lotRing) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z)
      maxZ = Math.max(maxZ, z)
    }
    const pad = Math.max(maxX - minX, maxZ - minZ) * 0.85
    const west = center.lng + (minX - pad) / frame.mPerDegLng
    const east = center.lng + (maxX + pad) / frame.mPerDegLng
    const south = center.lat - (maxZ + pad) / frame.mPerDegLat
    const north = center.lat - (minZ - pad) / frame.mPerDegLat

    const scene = new THREE.Scene()
    scene.fog = null
    scene.background = new THREE.Color(0x6ea8e0)

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.35,
      4000
    )
    cameraRef.current = camera
    const span = Math.max(maxX - minX, maxZ - minZ, 40)
    camera.position.set(span * 0.2, span * 0.45, span * 0.95)

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.maxPolarAngle = Math.PI * 0.495
    controls.minDistance = 6
    controls.maxDistance = span * 4
    controlsRef.current = controls

    const sky = makeClearSky(2800)
    scene.add(sky)

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const sun = new THREE.DirectionalLight(0xfff1dd, 1.25)
    sun.position.set(55, 90, 30)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -80
    sun.shadow.camera.right = 80
    sun.shadow.camera.top = 80
    sun.shadow.camera.bottom = -80
    scene.add(sun)
    scene.add(new THREE.HemisphereLight(0xb8d4f0, 0xc4b89a, 0.45))

    const [gx0, gz0] = frame.toLocal(south, west)
    const [gx1, gz1] = frame.toLocal(north, east)
    const groundW = Math.abs(gx1 - gx0)
    const groundD = Math.abs(gz1 - gz0)
    const groundCx = (gx0 + gx1) / 2
    const groundCz = (gz0 + gz1) / 2

    const groundGeo = new THREE.PlaneGeometry(groundW, groundD, 1, 1)
    groundGeo.rotateX(-Math.PI / 2)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x8a7f68,
      roughness: 1,
      side: THREE.DoubleSide,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.position.set(groundCx, 0, groundCz)
    ground.receiveShadow = true
    scene.add(ground)

    const rayGround = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    rayGround.rotation.x = -Math.PI / 2
    scene.add(rayGround)

    const shape = new THREE.Shape(lotRing.map(([x, z]) => new THREE.Vector2(x, z)))
    const fillGeo = new THREE.ShapeGeometry(shape)
    fillGeo.rotateX(-Math.PI / 2)
    const fill = new THREE.Mesh(
      fillGeo,
      new THREE.MeshBasicMaterial({
        color: 0xf2b04a,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    fill.position.y = 0.04
    scene.add(fill)

    const boundaryPts = lotRing.map(([x, z]) => new THREE.Vector3(x, 0.08, z))
    boundaryPts.push(boundaryPts[0].clone())
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(boundaryPts),
        new THREE.LineBasicMaterial({ color: 0xf2b04a, linewidth: 2 })
      )
    )

    // Street-front marker (where driveway starts)
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.18, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x6e6e70, roughness: 0.95 })
    )
    curb.position.set(frontMid[0], 0.1, frontMid[1])
    scene.add(curb)

    for (const n of neighbors) {
      if (!n.geometry) continue
      const nRing = ringToLocal(n.geometry.coordinates[0], frame)
      if (nRing.length < 3) continue
      const pts = nRing.map(([x, z]) => new THREE.Vector3(x, 0.06, z))
      pts.push(pts[0].clone())
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
        )
      )
    }

    const anchor = new THREE.Group()
    anchor.visible = false
    anchor.position.set(0, 0, 0)
    scene.add(anchor)
    anchorRef.current = anchor

    const houseMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.12,
    })
    const cutout = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), houseMat)
    cutout.visible = false
    cutout.position.set(0, 1, 0)
    // Face the street (−z): PlaneGeometry faces +z by default
    cutout.rotation.y = Math.PI
    // Tiny lean so the facade still peeks when glancing from above
    cutout.rotation.x = -0.04
    anchor.add(cutout)
    cutoutRef.current = cutout
    texUrlRef.current = null

    // Soft footprint under the cutout — readable from aerial before you orbit
    const footPad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x1a1c1e,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    )
    footPad.rotation.x = -Math.PI / 2
    footPad.position.y = 0.06
    footPad.visible = false
    footPad.name = 'footprintPad'
    anchor.add(footPad)

    const approach = new THREE.Object3D()
    approach.name = 'garageApproach'
    // Tip of the driveway — at the garage door on the facade (updated in syncTransform)
    approach.position.set(0, 0, 0)
    anchor.add(approach)
    approachRef.current = approach

    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x9a9890,
      roughness: 0.95,
      metalness: 0.02,
    })
    const apron = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), apronMat)
    apron.receiveShadow = true
    apron.visible = false
    apron.name = 'garageApron'
    anchor.add(apron)
    apronRef.current = apron

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 40),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.03
    shadow.visible = false
    scene.add(shadow)
    shadowRef.current = shadow

    // Driveway ribbon
    const asphaltMap = makeAsphaltTexture()
    const drivewayMat = new THREE.MeshStandardMaterial({
      map: asphaltMap,
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.02,
    })
    const driveway = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1), drivewayMat)
    driveway.receiveShadow = true
    driveway.visible = false
    scene.add(driveway)
    drivewayRef.current = driveway

    const landscapeRoot = new THREE.Group()
    scene.add(landscapeRoot)
    landscapeRef.current = landscapeRoot

    const worldApproach = new THREE.Vector3()
    const syncDriveway = () => {
      if (!drivewayRef.current || !anchorRef.current?.visible || !cutoutRef.current?.visible) {
        if (drivewayRef.current) drivewayRef.current.visible = false
        if (apronRef.current) apronRef.current.visible = false
        onDrivewayChange(null)
        return
      }
      const approach = approachRef.current
      if (approach) {
        approach.getWorldPosition(worldApproach)
      } else {
        worldApproach.set(anchor.position.x, 0, anchor.position.z)
      }

      const [fx, fz] = frontMidRef.current
      const dx = worldApproach.x - fx
      const dz = worldApproach.z - fz
      const len = Math.hypot(dx, dz)
      if (len < 0.5) {
        driveway.visible = false
        if (apronRef.current) apronRef.current.visible = false
        onDrivewayChange(null)
        return
      }

      // Driveway ribbon: street curb → garage door (runs the full length to the house)
      const widthM = 14 * FT_TO_M
      const isConcrete = materialRef.current === 'concrete'
      driveway.visible = true
      driveway.position.set((fx + worldApproach.x) / 2, 0.05, (fz + worldApproach.z) / 2)
      driveway.scale.set(widthM, 1, len)
      driveway.rotation.y = Math.atan2(dx, dz)
      asphaltMap.repeat.set(widthM / 2, Math.max(1, len / 2))
      asphaltMap.needsUpdate = true
      drivewayMat.color.set(isConcrete ? 0xb0aea8 : 0xffffff)

      if (apronRef.current) {
        const am = apronRef.current.material as THREE.MeshStandardMaterial
        am.color.set(isConcrete ? 0xa8a69e : 0x5a5a5c)
      }

      onDrivewayChange(estimateDriveway(len, materialRef.current))
    }
    syncDrivewayRef.current = syncDriveway

    if (planId) {
      planIdRef.current = planId
      const plan = getPlan(planId)
      const yawRad = Math.atan2(-(frontMid[0] - 0), -(frontMid[1] - 0))
      const yawDeg = Math.round(THREE.MathUtils.radToDeg(yawRad))
      onYawSuggest(yawDeg)
      yawRef.current = yawDeg
      widthRef.current = houseWidthFt
      if (plan?.cutoutImg) {
        loadCutoutTexture(
          plan.cutoutImg,
          `${plan.name} on the lot — street view of the real elevation.`,
          true
        )
      }
    }

    onStatus('Loading aerial photo of this lot…')
    void loadAerialTexture({ south, west, north, east }).then((aerial) => {
      if (disposed || !aerial) {
        if (!disposed) {
          onStatus(
            'Aerial imagery unavailable — lot outline is still accurate. Pick a builder plan or upload a photo.'
          )
        }
        return
      }
      const uv = groundGeo.attributes.uv as THREE.BufferAttribute
      const pos = groundGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + ground.position.x
        const z = pos.getZ(i) + ground.position.z
        const lng = center.lng + x / frame.mPerDegLng
        const lat = center.lat - z / frame.mPerDegLat
        const [u, v] = aerialUV(lat, lng, aerial.bbox)
        uv.setXY(i, u, v)
      }
      uv.needsUpdate = true
      aerial.texture.anisotropy = Math.min(16, renderer?.capabilities.getMaxAnisotropy() ?? 8)
      aerial.texture.colorSpace = THREE.SRGBColorSpace
      groundMat.map = aerial.texture
      groundMat.color.set(0xffffff)
      groundMat.needsUpdate = true
      if (!disposed) {
        onStatus(
          `Lot ${lot.properties.name} ready — drop a builder plan; driveway + landscaping tools are below.`
        )
      }
    })

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let dragging = false

    const setFromEvent = (e: PointerEvent) => {
      const rect = renderer!.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const hitGround = (e: PointerEvent): THREE.Vector3 | null => {
      setFromEvent(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObject(rayGround, false)
      return hits[0]?.point ?? null
    }

    const tallyLandscape = () => {
      const root = landscapeRef.current
      if (!root) return
      let usd = 0
      let count = 0
      for (const child of root.children) {
        const kind = child.userData.plantKind as PlantKind | undefined
        if (!kind) continue
        count += 1
        // costs imported lazily via userData set at plant time
        usd += (child.userData.costUsd as number) || 0
      }
      onLandscapeCostChange(usd, count)
    }

    const moveHouse = (e: PointerEvent) => {
      if (!anchor.visible) return
      const pt = hitGround(e)
      if (!pt) return
      anchor.position.x = pt.x
      anchor.position.z = pt.z
      syncTransform()
    }

    const plantAt = (e: PointerEvent) => {
      const pt = hitGround(e)
      const root = landscapeRef.current
      if (!pt || !root) return
      const kind = plantKindRef.current
      const plant = buildPlant(kind)
      plant.position.set(pt.x, 0, pt.z)
      plant.rotation.y = Math.random() * Math.PI * 2
      // cost stamped for tally
      const costs: Record<PlantKind, number> = {
        tree: 450,
        evergreen: 380,
        shrub: 85,
        lawn: 180,
      }
      plant.userData.costUsd = costs[kind]
      root.add(plant)
      tallyLandscape()
      onStatus(`Placed ${kind} — keep clicking to plant more, or switch modes.`)
    }

    const onDown = (e: PointerEvent) => {
      if (modeRef.current === 'plant') {
        plantAt(e)
        return
      }
      if (modeRef.current !== 'place' || !anchor.visible) return
      dragging = true
      controls.enabled = false
      renderer!.domElement.setPointerCapture(e.pointerId)
      moveHouse(e)
    }
    const onMove = (e: PointerEvent) => {
      if (dragging) moveHouse(e)
    }
    const onUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      controls.enabled = modeRef.current === 'look'
      try {
        renderer!.domElement.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointercancel', onUp)

    const onResize = () => {
      if (!renderer || !mount) return
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight)
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const tick = () => {
      if (disposed) return
      controls.update()
      renderer!.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer?.domElement.removeEventListener('pointerdown', onDown)
      renderer?.domElement.removeEventListener('pointermove', onMove)
      renderer?.domElement.removeEventListener('pointerup', onUp)
      renderer?.domElement.removeEventListener('pointercancel', onUp)
      controls.dispose()
      controlsRef.current = null
      disposeSky(sky)
      groundGeo.dispose()
      groundMat.map?.dispose()
      groundMat.dispose()
      fillGeo.dispose()
      ;(fill.material as THREE.Material).dispose()
      if (landscapeRef.current) {
        disposeObject3D(landscapeRef.current)
        landscapeRef.current = null
      }
      houseMat.map?.dispose()
      houseMat.dispose()
      cutout.geometry.dispose()
      shadow.geometry.dispose()
      ;(shadow.material as THREE.Material).dispose()
      driveway.geometry.dispose()
      drivewayMat.dispose()
      asphaltMap.dispose()
      apron.geometry.dispose()
      apronMat.dispose()
      rayGround.geometry.dispose()
      ;(rayGround.material as THREE.Material).dispose()
      curb.geometry.dispose()
      ;(curb.material as THREE.Material).dispose()
      renderer?.dispose()
      if (renderer?.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
      anchorRef.current = null
      cutoutRef.current = null
      approachRef.current = null
      apronRef.current = null
      shadowRef.current = null
      drivewayRef.current = null
      cameraRef.current = null
      planIdRef.current = null
      texUrlRef.current = null
      syncDrivewayRef.current = () => {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot, neighbors, onStatus, onLoadError])

  useEffect(() => {
    const controls = controlsRef.current
    if (controls) controls.enabled = mode === 'look'
  }, [mode])

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    />
  )
}
