import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FT_TO_M, makeFrame, ringToLocal, type LocalFrame } from '../components/lotVisualizer/geo'
import { aerialUV, loadAerialTexture } from '../components/lotVisualizer/imagery'
import type { StadiumLotFeature } from '../components/LotMap'
import { disposeSky, makeClearSky } from './sky'

export type StudioMode = 'look' | 'place'

interface StudioCanvasProps {
  lot: StadiumLotFeature
  neighbors: StadiumLotFeature[]
  mode: StudioMode
  houseImageUrl: string | null
  houseWidthFt: number
  houseYawDeg: number
  onStatus: (msg: string) => void
  onLoadError: (msg: string) => void
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

/**
 * Lot-first world: real aerial photo, plat outline, house photo cutout in feet.
 * This is the Track B primary experience — not the Polycam splat blob.
 */
export default function StudioCanvas({
  lot,
  neighbors,
  mode,
  houseImageUrl,
  houseWidthFt,
  houseYawDeg,
  onStatus,
  onLoadError,
}: StudioCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef(mode)
  const houseRef = useRef<THREE.Mesh | null>(null)
  const groundY = 0.05
  const controlsRef = useRef<OrbitControls | null>(null)
  const widthRef = useRef(houseWidthFt)
  const yawRef = useRef(houseYawDeg)
  const texUrlRef = useRef<string | null>(null)
  const frameRef = useRef<LocalFrame | null>(null)
  const lotRingRef = useRef<[number, number][]>([])

  modeRef.current = mode
  widthRef.current = houseWidthFt
  yawRef.current = houseYawDeg

  useEffect(() => {
    const mesh = houseRef.current
    if (!mesh) return
    const w = houseWidthFt * FT_TO_M
    const aspect = (mesh.userData.aspect as number) || 1.6
    mesh.scale.set(w, w / aspect, 1)
    mesh.rotation.y = THREE.MathUtils.degToRad(houseYawDeg)
    mesh.position.y = groundY + mesh.scale.y / 2
  }, [houseWidthFt, houseYawDeg])

  useEffect(() => {
    const mesh = houseRef.current
    if (!mesh || !houseImageUrl) return
    if (texUrlRef.current === houseImageUrl) return
    texUrlRef.current = houseImageUrl

    new THREE.TextureLoader().load(
      houseImageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        const img = tex.image as HTMLImageElement
        const aspect = img.width / Math.max(1, img.height)
        mesh.userData.aspect = aspect
        const mat = mesh.material as THREE.MeshBasicMaterial
        mat.map?.dispose()
        mat.map = tex
        mat.transparent = true
        mat.needsUpdate = true
        mesh.visible = true
        const w = widthRef.current * FT_TO_M
        mesh.scale.set(w, w / aspect, 1)
        mesh.position.y = groundY + mesh.scale.y / 2
        onStatus('House on the lot — drag to move, set width in feet, turn to face the view.')
      },
      undefined,
      () => onLoadError('Could not load the house photo.')
    )
  }, [houseImageUrl, onStatus, onLoadError])

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
    lotRingRef.current = lotRing

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
    const span = Math.max(maxX - minX, maxZ - minZ, 40)
    // Start a bit lower so sky reads at the horizon (drone street feel)
    camera.position.set(span * 0.2, span * 0.45, span * 0.95)

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
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

    scene.add(new THREE.AmbientLight(0xffffff, 0.95))
    const sun = new THREE.DirectionalLight(0xfff4e5, 0.9)
    sun.position.set(40, 80, 20)
    scene.add(sun)
    scene.add(new THREE.HemisphereLight(0xb8d4f0, 0xc4b89a, 0.35))

    // Ground plane in local meters covering the aerial bbox
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

    // Invisible raycast plane
    const rayGround = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    rayGround.rotation.x = -Math.PI / 2
    scene.add(rayGround)

    // Lot fill
    const shape = new THREE.Shape(lotRing.map(([x, z]) => new THREE.Vector2(x, z)))
    const fillGeo = new THREE.ShapeGeometry(shape)
    fillGeo.rotateX(-Math.PI / 2)
    const fill = new THREE.Mesh(
      fillGeo,
      new THREE.MeshBasicMaterial({
        color: 0xf2b04a,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    fill.position.y = 0.04
    scene.add(fill)

    // Lot boundary line
    const boundaryPts = lotRing.map(([x, z]) => new THREE.Vector3(x, 0.08, z))
    boundaryPts.push(boundaryPts[0].clone())
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(boundaryPts),
        new THREE.LineBasicMaterial({ color: 0xf2b04a, linewidth: 2 })
      )
    )

    // Neighbor outlines for context
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

    // House cutout
    const houseMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const house = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), houseMat)
    house.visible = false
    house.position.set(0, 1, 0)
    scene.add(house)
    houseRef.current = house
    texUrlRef.current = null

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

    const syncShadow = () => {
      if (!house.visible) {
        shadow.visible = false
        return
      }
      shadow.visible = true
      shadow.position.x = house.position.x
      shadow.position.z = house.position.z
      const s = Math.max(house.scale.x, house.scale.y) * 0.4
      shadow.scale.set(s, s, 1)
    }

    onStatus('Loading aerial photo of this lot…')
    void loadAerialTexture({ south, west, north, east }).then((aerial) => {
      if (disposed || !aerial) {
        if (!disposed) onStatus('Aerial imagery unavailable — lot outline is still accurate. Upload a house photo to place.')
        return
      }
      // Remap UVs so the plane matches the stitched aerial bbox
      const uv = groundGeo.attributes.uv as THREE.BufferAttribute
      // PlaneGeometry default UVs after rotateX(-90): need lat/lng corners
      const corners: [number, number][] = [
        [south, west],
        [south, east],
        [north, west],
        [north, east],
      ]
      // Buffer order for PlaneGeometry(w,d): after rotateX, check indices
      // Simpler: rebuild UVs from vertex XZ → lat/lng
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
      void corners
      aerial.texture.anisotropy = Math.min(16, renderer?.capabilities.getMaxAnisotropy() ?? 8)
      aerial.texture.colorSpace = THREE.SRGBColorSpace
      groundMat.map = aerial.texture
      groundMat.color.set(0xffffff)
      groundMat.needsUpdate = true
      if (!disposed) {
        onStatus(
          `Lot ${lot.properties.name} ready — tip the view toward the horizon for sky, or upload a house photo.`
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

    const moveHouse = (e: PointerEvent) => {
      if (!house.visible) return
      setFromEvent(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObject(rayGround, false)
      if (!hits[0]) return
      house.position.x = hits[0].point.x
      house.position.z = hits[0].point.z
      house.position.y = groundY + house.scale.y / 2
      syncShadow()
    }

    const onDown = (e: PointerEvent) => {
      if (modeRef.current !== 'place' || !house.visible) return
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
      syncShadow()
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
      houseMat.map?.dispose()
      houseMat.dispose()
      house.geometry.dispose()
      shadow.geometry.dispose()
      ;(shadow.material as THREE.Material).dispose()
      rayGround.geometry.dispose()
      ;(rayGround.material as THREE.Material).dispose()
      renderer?.dispose()
      if (renderer?.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
      houseRef.current = null
    }
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
