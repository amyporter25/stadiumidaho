import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STUDIO_WORLD } from './config'

export type StudioMode = 'look' | 'place'

interface StudioCanvasProps {
  splatUrl: string
  mode: StudioMode
  houseImageUrl: string | null
  houseWidthFt: number
  houseYawDeg: number
  unitsPerFoot: number
  groundY: number
  onStatus: (msg: string) => void
  onLoadError: (msg: string) => void
}

/**
 * Splat world + photo cutout using GaussianSplats3D.Viewer with a shared
 * threeScene (the path recommended by the library — avoids DropInViewer issues).
 */
export default function StudioCanvas({
  splatUrl,
  mode,
  houseImageUrl,
  houseWidthFt,
  houseYawDeg,
  unitsPerFoot,
  groundY,
  onStatus,
  onLoadError,
}: StudioCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef(mode)
  const houseRef = useRef<THREE.Mesh | null>(null)
  const groundRef = useRef<THREE.Mesh | null>(null)
  const shadowRef = useRef<THREE.Mesh | null>(null)
  const viewerRef = useRef<{
    controls?: { enabled: boolean } | null
    getRenderDimensions?: (out: number[]) => void
    camera?: THREE.Camera
  } | null>(null)
  const yawRef = useRef(houseYawDeg)
  const widthRef = useRef(houseWidthFt)
  const unitsRef = useRef(unitsPerFoot)
  const texUrlRef = useRef<string | null>(null)

  modeRef.current = mode
  yawRef.current = houseYawDeg
  widthRef.current = houseWidthFt
  unitsRef.current = unitsPerFoot

  useEffect(() => {
    const mesh = houseRef.current
    if (!mesh) return
    const w = houseWidthFt * unitsPerFoot
    const aspect = (mesh.userData.aspect as number) || 1.6
    mesh.scale.set(w, w / aspect, 1)
    mesh.rotation.y = THREE.MathUtils.degToRad(houseYawDeg)
    mesh.position.y =
      (groundRef.current?.position.y ?? groundY) + mesh.scale.y / 2
    const shadow = shadowRef.current
    if (shadow && mesh.visible) {
      shadow.position.set(mesh.position.x, groundY + 0.01, mesh.position.z)
      const s = Math.max(mesh.scale.x, mesh.scale.y) * 0.45
      shadow.scale.set(s, s, 1)
    }
  }, [houseWidthFt, houseYawDeg, unitsPerFoot, groundY])

  useEffect(() => {
    const mesh = houseRef.current
    if (!mesh || !houseImageUrl) return
    if (texUrlRef.current === houseImageUrl) return
    texUrlRef.current = houseImageUrl

    const loader = new THREE.TextureLoader()
    loader.load(
      houseImageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        const img = tex.image as HTMLImageElement
        const aspect = img.width / Math.max(1, img.height)
        mesh.userData.aspect = aspect
        const mat = mesh.material as THREE.MeshBasicMaterial
        if (mat.map) mat.map.dispose()
        mat.map = tex
        mat.transparent = true
        mat.needsUpdate = true
        mesh.visible = true
        const w = widthRef.current * unitsRef.current
        mesh.scale.set(w, w / aspect, 1)
        mesh.position.y =
          (groundRef.current?.position.y ?? groundY) + mesh.scale.y / 2
        const shadow = shadowRef.current
        if (shadow) {
          shadow.visible = true
          shadow.position.set(mesh.position.x, groundY + 0.01, mesh.position.z)
          const s = Math.max(mesh.scale.x, mesh.scale.y) * 0.45
          shadow.scale.set(s, s, 1)
        }
        onStatus('House placed — drag to move, use the sliders to size and turn.')
      },
      undefined,
      () => onLoadError('Could not load the house photo into the scene.')
    )
  }, [houseImageUrl, groundY, onStatus, onLoadError])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let viewer: InstanceType<
      typeof import('@mkkellogg/gaussian-splats-3d').Viewer
    > | null = null
    let pointerCleanup: (() => void) | null = null

    const threeScene = new THREE.Scene()

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = groundY
    threeScene.add(ground)
    groundRef.current = ground

    const houseMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const house = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), houseMat)
    house.visible = false
    house.position.set(0, groundY + 0.5, 0)
    threeScene.add(house)
    houseRef.current = house
    texUrlRef.current = null

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 32),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = groundY + 0.01
    shadow.visible = false
    threeScene.add(shadow)
    shadowRef.current = shadow

    ;(async () => {
      try {
        onStatus('Loading site capture…')
        const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d')
        if (disposed || !mountRef.current) return

        viewer = new GaussianSplats3D.Viewer({
          rootElement: mount,
          cameraUp: [0, 1, 0],
          initialCameraPosition: [...STUDIO_WORLD.cameraPosition],
          initialCameraLookAt: [...STUDIO_WORLD.cameraLookAt],
          selfDrivenMode: true,
          useBuiltInControls: true,
          sharedMemoryForWorkers: false,
          integerBasedSort: true,
          threeScene,
        })
        viewerRef.current = viewer as unknown as typeof viewerRef.current

        await viewer.addSplatScene(splatUrl, {
          progressiveLoad: true,
          showLoadingUI: false,
          splatAlphaRemovalThreshold: 5,
          ...(STUDIO_WORLD.splatRotationQuat
            ? { rotation: STUDIO_WORLD.splatRotationQuat }
            : {}),
        })
        if (disposed) return
        viewer.start()
        onStatus('Site capture ready — look around, then upload a house photo.')

        // Placement raycasts against the invisible ground using the viewer's camera.
        const raycaster = new THREE.Raycaster()
        const pointer = new THREE.Vector2()
        let dragging = false
        const canvas = mount.querySelector('canvas')
        if (!canvas) return

        const setFromEvent = (e: PointerEvent) => {
          const rect = canvas.getBoundingClientRect()
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        }

        const moveHouse = (e: PointerEvent) => {
          const cam = (viewer as unknown as { camera?: THREE.Camera }).camera
          if (!cam || !house.visible) return
          setFromEvent(e)
          raycaster.setFromCamera(pointer, cam as THREE.PerspectiveCamera)
          const hits = raycaster.intersectObject(ground, false)
          if (!hits[0]) return
          house.position.x = hits[0].point.x
          house.position.z = hits[0].point.z
          house.position.y = ground.position.y + house.scale.y / 2
          shadow.visible = true
          shadow.position.set(house.position.x, ground.position.y + 0.01, house.position.z)
          const s = Math.max(house.scale.x, house.scale.y) * 0.45
          shadow.scale.set(s, s, 1)
        }

        const onDown = (e: PointerEvent) => {
          if (modeRef.current !== 'place' || !house.visible) return
          dragging = true
          const controls = (viewer as unknown as { controls?: { enabled: boolean } }).controls
          if (controls) controls.enabled = false
          canvas.setPointerCapture(e.pointerId)
          moveHouse(e)
        }
        const onMove = (e: PointerEvent) => {
          if (dragging) moveHouse(e)
        }
        const onUp = (e: PointerEvent) => {
          if (!dragging) return
          dragging = false
          const controls = (viewer as unknown as { controls?: { enabled: boolean } }).controls
          if (controls) controls.enabled = modeRef.current === 'look'
          try {
            canvas.releasePointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
        }

        canvas.addEventListener('pointerdown', onDown)
        canvas.addEventListener('pointermove', onMove)
        canvas.addEventListener('pointerup', onUp)
        canvas.addEventListener('pointercancel', onUp)
        pointerCleanup = () => {
          canvas.removeEventListener('pointerdown', onDown)
          canvas.removeEventListener('pointermove', onMove)
          canvas.removeEventListener('pointerup', onUp)
          canvas.removeEventListener('pointercancel', onUp)
        }
      } catch (e) {
        console.error(e)
        onLoadError(
          'Could not load the splat world. If you pointed ?splat= at a new file, check the URL and CORS.'
        )
      }
    })()

    return () => {
      disposed = true
      pointerCleanup?.()
      void viewer?.dispose()
      viewerRef.current = null
      houseMat.map?.dispose()
      houseMat.dispose()
      house.geometry.dispose()
      ground.geometry.dispose()
      ;(ground.material as THREE.Material).dispose()
      shadow.geometry.dispose()
      ;(shadow.material as THREE.Material).dispose()
      houseRef.current = null
      groundRef.current = null
      shadowRef.current = null
      // Viewer owns the canvas element it created under mount.
      while (mount.firstChild) mount.removeChild(mount.firstChild)
    }
  }, [splatUrl, onStatus, onLoadError])

  useEffect(() => {
    const controls = viewerRef.current?.controls
    if (controls) controls.enabled = mode === 'look'
  }, [mode])

  useEffect(() => {
    const ground = groundRef.current
    const house = houseRef.current
    const shadow = shadowRef.current
    if (ground) ground.position.y = groundY
    if (house?.visible) {
      house.position.y = groundY + house.scale.y / 2
    }
    if (shadow) shadow.position.y = groundY + 0.01
  }, [groundY])

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    />
  )
}
