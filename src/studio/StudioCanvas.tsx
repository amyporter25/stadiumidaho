import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STUDIO_WORLD } from './config'

export type StudioMode = 'look' | 'place'

interface StudioCanvasProps {
  splatUrl: string
  mode: StudioMode
  houseImageUrl: string | null
  /** House width in feet — converted to splat-local units via unitsPerFoot. */
  houseWidthFt: number
  houseYawDeg: number
  unitsPerFoot: number
  groundY: number
  onStatus: (msg: string) => void
  onLoadError: (msg: string) => void
}

/**
 * Full-viewport splat world with an optional photo-cutout house.
 * Ground placement uses an invisible plane (splats have no mesh to raycast).
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
  const controlsRef = useRef<OrbitControls | null>(null)
  const yawRef = useRef(houseYawDeg)
  const widthRef = useRef(houseWidthFt)
  const unitsRef = useRef(unitsPerFoot)
  const texUrlRef = useRef<string | null>(null)

  modeRef.current = mode
  yawRef.current = houseYawDeg
  widthRef.current = houseWidthFt
  unitsRef.current = unitsPerFoot

  // Apply live width / yaw without rebuilding the scene.
  useEffect(() => {
    const mesh = houseRef.current
    if (!mesh) return
    const w = houseWidthFt * unitsPerFoot
    const aspect = (mesh.userData.aspect as number) || 1.6
    const h = w / aspect
    mesh.scale.set(w, h, 1)
    mesh.rotation.y = THREE.MathUtils.degToRad(houseYawDeg)
  }, [houseWidthFt, houseYawDeg, unitsPerFoot])

  // Swap house texture when a new cutout arrives.
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
        // Keep the base of the cutout on the ground plane.
        mesh.position.y = (groundRef.current?.position.y ?? groundY) + mesh.scale.y / 2
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
    let raf = 0
    let dropIn: import('@mkkellogg/gaussian-splats-3d').DropInViewer | null = null
    let renderer: THREE.WebGLRenderer | null = null

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1c1e)

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.05,
      500
    )
    camera.position.set(...STUDIO_WORLD.cameraPosition)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(...STUDIO_WORLD.cameraLookAt)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minDistance = 1
    controls.maxDistance = 80
    controlsRef.current = controls

    // Soft fill so the cutout reads when the splat is still loading.
    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const sun = new THREE.DirectionalLight(0xfff2e0, 1.1)
    sun.position.set(4, 8, 2)
    scene.add(sun)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = groundY
    scene.add(ground)
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
    scene.add(house)
    houseRef.current = house
    // Allow the texture effect to re-apply after a splat remount.
    texUrlRef.current = null

    // Contact shadow disc under the cutout — sells “on the ground” without a full shadow map.
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
    scene.add(shadow)

    const syncShadow = () => {
      if (!house.visible) {
        shadow.visible = false
        return
      }
      shadow.visible = true
      shadow.position.x = house.position.x
      shadow.position.z = house.position.z
      shadow.position.y = ground.position.y + 0.01
      const s = Math.max(house.scale.x, house.scale.y) * 0.45
      shadow.scale.set(s, s, 1)
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let dragging = false

    const setFromEvent = (e: PointerEvent) => {
      const rect = renderer!.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const moveHouseToPointer = (e: PointerEvent) => {
      if (!house.visible) return
      setFromEvent(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObject(ground, false)
      if (!hits[0]) return
      house.position.x = hits[0].point.x
      house.position.z = hits[0].point.z
      house.position.y = ground.position.y + house.scale.y / 2
      syncShadow()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (modeRef.current !== 'place' || !house.visible) return
      setFromEvent(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects([house, ground], false)
      if (!hits[0]) return
      dragging = true
      controls.enabled = false
      renderer!.domElement.setPointerCapture(e.pointerId)
      moveHouseToPointer(e)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      moveHouseToPointer(e)
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      controls.enabled = modeRef.current === 'look'
      try {
        renderer!.domElement.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerUp)

    const onResize = () => {
      if (!renderer || !mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / Math.max(1, h)
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const tick = () => {
      if (disposed) return
      controls.update()
      // Keep cutout upright facing roughly the camera yaw (billboard-lite):
      // we only auto-yaw when the user hasn't set a custom rotation preference…
      // Actually we honor houseYawDeg exclusively — no auto billboard.
      syncShadow()
      renderer!.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }

    ;(async () => {
      try {
        onStatus('Loading site capture…')
        const GaussianSplats3D = await import('@mkkellogg/gaussian-splats-3d')
        if (disposed) return
        dropIn = new GaussianSplats3D.DropInViewer({
          sharedMemoryForWorkers: false,
          selfDrivenMode: false,
          useBuiltInControls: false,
          integerBasedSort: true,
        })
        scene.add(dropIn)
        await dropIn.addSplatScene(splatUrl, {
          progressiveLoad: true,
          showLoadingUI: false,
          splatAlphaRemovalThreshold: 5,
        })
        if (disposed) return
        onStatus('Site capture ready — look around, then upload a house photo.')
      } catch (e) {
        console.error(e)
        onLoadError(
          'Could not load the splat world. If you pointed ?splat= at a new file, check the URL and CORS.'
        )
      }
      if (!disposed) raf = requestAnimationFrame(tick)
    })()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer?.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer?.domElement.removeEventListener('pointermove', onPointerMove)
      renderer?.domElement.removeEventListener('pointerup', onPointerUp)
      renderer?.domElement.removeEventListener('pointercancel', onPointerUp)
      controls.dispose()
      controlsRef.current = null
      void dropIn?.dispose()
      houseMat.map?.dispose()
      houseMat.dispose()
      house.geometry.dispose()
      ground.geometry.dispose()
      ;(ground.material as THREE.Material).dispose()
      shadow.geometry.dispose()
      ;(shadow.material as THREE.Material).dispose()
      renderer?.dispose()
      if (renderer?.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement)
      }
      houseRef.current = null
      groundRef.current = null
    }
  }, [splatUrl, onStatus, onLoadError])

  // Toggle orbit vs place without remounting WebGL.
  useEffect(() => {
    const controls = controlsRef.current
    if (controls) controls.enabled = mode === 'look'
  }, [mode])

  // Nudge the raycast plane / house base without reloading the splat.
  useEffect(() => {
    const ground = groundRef.current
    const house = houseRef.current
    if (ground) ground.position.y = groundY
    if (house?.visible) {
      house.position.y = groundY + house.scale.y / 2
    }
  }, [groundY])

  return (
    <div
      ref={mountRef}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    />
  )
}
