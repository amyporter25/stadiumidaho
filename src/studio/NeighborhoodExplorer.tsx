import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { makeFrame, ringToLocal } from '../components/lotVisualizer/geo'
import { aerialUV, loadAerialTexture } from '../components/lotVisualizer/imagery'
import { useStadiumLots, type StadiumLotFeature } from '../components/LotMap'
import { disposeSky, makeClearSky } from './sky'

type Filter = 'plat2' | 'block3' | 'all'

function centroidOf(f: StadiumLotFeature): { lat: number; lng: number } | null {
  if (f.properties.label) {
    return { lng: f.properties.label[0], lat: f.properties.label[1] }
  }
  if (!f.geometry) return null
  const ring = f.geometry.coordinates[0]
  let lat = 0
  let lng = 0
  for (const [x, y] of ring) {
    lng += x
    lat += y
  }
  return { lat: lat / ring.length, lng: lng / ring.length }
}

function matchesFilter(f: StadiumLotFeature, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'plat2') return f.properties.phase === 'Plat 2'
  return /\/3$/.test(f.properties.name) // Block 3 on the Phase 2 plat sheet
}

/**
 * Google Earth–style neighborhood explorer:
 * georeferenced aerial + plat lot lines + free fly/orbit.
 * Drone video is linked as a cinematic tour (oblique flight ≠ accurate ortho).
 */
export default function NeighborhoodExplorer() {
  const features = useStadiumLots()
  const navigate = useNavigate()
  const mountRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<Filter>('plat2')
  const [status, setStatus] = useState('Loading neighborhood…')
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const visible = useMemo(() => {
    if (!features) return []
    return features.filter((f) => f.geometry && matchesFilter(f, filter))
  }, [features, filter])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || visible.length === 0) return

    let disposed = false
    let raf = 0
    let renderer: THREE.WebGLRenderer | null = null
    let labelRenderer: CSS2DRenderer | null = null

    let minLat = 90
    let maxLat = -90
    let minLng = 180
    let maxLng = -180
    for (const f of visible) {
      for (const [lng, lat] of f.geometry!.coordinates[0]) {
        minLat = Math.min(minLat, lat)
        maxLat = Math.max(maxLat, lat)
        minLng = Math.min(minLng, lng)
        maxLng = Math.max(maxLng, lng)
      }
    }
    // Extra pad so zoomed-out views stay on imagery instead of empty haze rim
    const padLat = (maxLat - minLat) * 0.28
    const padLng = (maxLng - minLng) * 0.28
    minLat -= padLat
    maxLat += padLat
    minLng -= padLng
    maxLng += padLng

    const lat0 = (minLat + maxLat) / 2
    const lng0 = (minLng + maxLng) / 2
    const frame = makeFrame(lat0, lng0)

    const scene = new THREE.Scene()
    // No distance fog — that gray wash was reading as “hazy all around”
    scene.fog = null
    scene.background = new THREE.Color(0x6ea8e0)

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.5,
      8000
    )

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    mount.appendChild(renderer.domElement)

    labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(mount.clientWidth, mount.clientHeight)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.inset = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    mount.appendChild(labelRenderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    // Allow near-horizon views so sky fills the frame (street / lot feel)
    controls.maxPolarAngle = Math.PI * 0.495
    controls.minDistance = 12
    controls.screenSpacePanning = true

    const sky = makeClearSky(5000)
    scene.add(sky)

    scene.add(new THREE.AmbientLight(0xffffff, 0.95))
    const sun = new THREE.DirectionalLight(0xfff2e0, 0.85)
    sun.position.set(120, 220, 60)
    scene.add(sun)
    const hemi = new THREE.HemisphereLight(0xb8d4f0, 0xc4b89a, 0.35)
    scene.add(hemi)

    const [gx0, gz0] = frame.toLocal(minLat, minLng)
    const [gx1, gz1] = frame.toLocal(maxLat, maxLng)
    const minX = Math.min(gx0, gx1)
    const maxX = Math.max(gx0, gx1)
    const minZ = Math.min(gz0, gz1)
    const maxZ = Math.max(gz0, gz1)
    const groundW = maxX - minX
    const groundD = maxZ - minZ
    const groundCx = (minX + maxX) / 2
    const groundCz = (minZ + maxZ) / 2

    const span = Math.max(groundW, groundD)
    camera.position.set(groundCx + span * 0.05, span * 0.75, groundCz + span * 0.85)
    controls.target.set(groundCx, 0, groundCz)
    controls.maxDistance = span * 3.5

    const groundGeo = new THREE.PlaneGeometry(groundW, groundD, 1, 1)
    groundGeo.rotateX(-Math.PI / 2)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x8a7f68,
      roughness: 1,
      side: THREE.DoubleSide,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.position.set(groundCx, 0, groundCz)
    scene.add(ground)

    // Soft dirt surround beyond the aerial tile so the site doesn’t end in a hard void
    const surround = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(groundW, groundD) * 1.8, 64),
      new THREE.MeshStandardMaterial({
        color: 0xb8a888,
        roughness: 1,
        side: THREE.DoubleSide,
      })
    )
    surround.rotation.x = -Math.PI / 2
    surround.position.set(groundCx, -0.4, groundCz)
    scene.add(surround)

    type LotPick = { name: string; mesh: THREE.Mesh }
    const pickables: LotPick[] = []
    const labelNodes: HTMLDivElement[] = []

    for (const f of visible) {
      const ring = ringToLocal(f.geometry!.coordinates[0], frame)
      if (ring.length < 3) continue

      const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, z)))
      const fillGeo = new THREE.ShapeGeometry(shape)
      fillGeo.rotateX(-Math.PI / 2)
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0xf2b04a,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const fill = new THREE.Mesh(fillGeo, fillMat)
      fill.position.y = 0.35
      fill.userData.lotName = f.properties.name
      scene.add(fill)
      pickables.push({ name: f.properties.name, mesh: fill })

      const boundaryPts = ring.map(([x, z]) => new THREE.Vector3(x, 0.5, z))
      boundaryPts.push(boundaryPts[0].clone())
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(boundaryPts),
          new THREE.LineBasicMaterial({ color: 0xffc857 })
        )
      )

      const c = centroidOf(f)
      if (c) {
        const [lx, lz] = frame.toLocal(c.lat, c.lng)
        const el = document.createElement('div')
        el.textContent = f.properties.name
        el.style.cssText =
          'font:600 11px "IBM Plex Sans",sans-serif;color:#1a1c1e;background:rgba(255,255,255,0.82);padding:2px 6px;border-radius:4px;white-space:nowrap;border:1px solid rgba(0,0,0,0.12);'
        labelNodes.push(el)
        const obj = new CSS2DObject(el)
        obj.position.set(lx, 1.2, lz)
        scene.add(obj)
      }
    }

    setStatus('Loading aerial photography…')
    void loadAerialTexture({
      south: minLat,
      west: minLng,
      north: maxLat,
      east: maxLng,
    }).then((aerial) => {
      if (disposed || !aerial) {
        if (!disposed) {
          setStatus('Aerial tiles unavailable — lot lines are still accurate. Orbit to explore.')
        }
        return
      }
      const uv = groundGeo.attributes.uv as THREE.BufferAttribute
      const pos = groundGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + ground.position.x
        const z = pos.getZ(i) + ground.position.z
        const lng = lng0 + x / frame.mPerDegLng
        const lat = lat0 - z / frame.mPerDegLat
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
        setStatus(
          'Drag to orbit · scroll toward the street · WASD to glide · tip camera to see the sky · click a lot'
        )
      }
    })

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let currentHover: THREE.Mesh | null = null

    const setPointer = (e: PointerEvent) => {
      const rect = renderer!.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const onMove = (e: PointerEvent) => {
      setPointer(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(
        pickables.map((p) => p.mesh),
        false
      )
      const hit = hits[0]?.object as THREE.Mesh | undefined
      if (currentHover && currentHover !== hit) {
        ;(currentHover.material as THREE.MeshBasicMaterial).opacity = 0.12
        ;(currentHover.material as THREE.MeshBasicMaterial).color.set(0xf2b04a)
      }
      if (hit) {
        ;(hit.material as THREE.MeshBasicMaterial).opacity = 0.32
        ;(hit.material as THREE.MeshBasicMaterial).color.set(0xffe08a)
        setHovered(hit.userData.lotName as string)
        renderer!.domElement.style.cursor = 'pointer'
      } else {
        setHovered(null)
        renderer!.domElement.style.cursor = 'grab'
      }
      currentHover = hit ?? null
    }

    const onClick = (e: PointerEvent) => {
      setPointer(e)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(
        pickables.map((p) => p.mesh),
        false
      )
      const name = hits[0]?.object.userData.lotName as string | undefined
      if (!name) return
      setSelected(name)
      navigate(`/studio?lot=${encodeURIComponent(name)}`)
    }

    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('click', onClick)

    const keys = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase())
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const onResize = () => {
      if (!renderer || !labelRenderer || !mount) return
      camera.aspect = mount.clientWidth / Math.max(1, mount.clientHeight)
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      labelRenderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    const tick = () => {
      if (disposed) return
      const speed = Math.max(2, controls.getDistance() * 0.008)
      const glide = (sign: number, strafe: boolean) => {
        const dir = new THREE.Vector3()
        camera.getWorldDirection(dir)
        dir.y = 0
        dir.normalize()
        if (strafe) dir.cross(camera.up)
        camera.position.addScaledVector(dir, sign * speed)
        controls.target.addScaledVector(dir, sign * speed)
      }
      if (keys.has('w') || keys.has('arrowup')) glide(1, false)
      if (keys.has('s') || keys.has('arrowdown')) glide(-1, false)
      if (keys.has('a') || keys.has('arrowleft')) glide(-1, true)
      if (keys.has('d') || keys.has('arrowright')) glide(1, true)
      controls.update()
      renderer!.render(scene, camera)
      labelRenderer!.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      renderer?.domElement.removeEventListener('pointermove', onMove)
      renderer?.domElement.removeEventListener('click', onClick)
      controls.dispose()
      disposeSky(sky)
      surround.geometry.dispose()
      ;(surround.material as THREE.Material).dispose()
      groundGeo.dispose()
      groundMat.map?.dispose()
      groundMat.dispose()
      for (const p of pickables) {
        p.mesh.geometry.dispose()
        ;(p.mesh.material as THREE.Material).dispose()
      }
      for (const el of labelNodes) el.remove()
      renderer?.dispose()
      if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement)
      if (labelRenderer?.domElement.parentElement === mount) {
        mount.removeChild(labelRenderer.domElement)
      }
    }
  }, [visible, navigate])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#6ea8e0',
        color: '#1a1c1e',
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      }}
    >
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          padding: '14px 18px',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.85), transparent)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              opacity: 0.55,
            }}
          >
            Track B · Neighborhood explorer
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>
            The Stadium — aerial + plat lines
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            pointerEvents: 'auto',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            style={selectStyle}
          >
            <option value="plat2">Plat 2 (Phase 2 sheet)</option>
            <option value="block3">Block 3 only</option>
            <option value="all">All lots</option>
          </select>
          <Link to="/studio/sample" style={linkStyle}>
            Drone flyover sample
          </Link>
          <Link to="/studio" style={linkStyle}>
            Place a house
          </Link>
        </div>
      </header>

      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 18,
          zIndex: 2,
          maxWidth: 420,
          padding: '12px 14px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(0,0,0,0.08)',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        <div>{status}</div>
        {(hovered || selected) && (
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            {hovered ? `Lot ${hovered}` : null}
            {selected ? ` · Opening lot ${selected}…` : null}
          </div>
        )}
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          Plot lines come from the plat so they stay accurate. The aerial base is georeferenced
          imagery (so lines sit on the right ground). Your Phase 3 drone clip is the{' '}
          <Link to="/studio/sample" style={{ color: '#8a6a3a' }}>
            flyover sample
          </Link>
          — a freehand oblique flight isn’t a Google Earth mesh by itself, so we don’t turn it into
          another splat blob.
        </div>
        <div style={{ marginTop: 6, opacity: 0.65 }}>
          WASD / arrows to glide · click a lot to place a house
        </div>
      </div>
    </div>
  )
}

const linkStyle: CSSProperties = {
  color: '#1a1c1e',
  textDecoration: 'none',
  fontSize: 13,
  borderBottom: '1px solid rgba(26,28,30,0.35)',
}

const selectStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(0,0,0,0.15)',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 12,
}
