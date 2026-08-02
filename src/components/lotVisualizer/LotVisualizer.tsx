import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { trpc } from '@/providers/trpc'
import { homePlans } from '../../data/plans'
import {
  makeFrame,
  ringToLocal,
  ringCentroid,
  frontEdgeMidpoint,
  insetRing,
  pointInRingXZ,
  FT_TO_M,
  type LocalFrame,
} from './geo'
import { buildHouse, houseFootprint } from './houses'
import { loadAerialTexture, aerialUV } from './imagery'

/* ------------------------------------------------------------------ */
/* solar (same approximation as the rest of the app)                   */
/* ------------------------------------------------------------------ */
const D2R = Math.PI / 180
const R2D = 180 / Math.PI
function sunPosition(dateUtcMs: number, lat: number, lng: number) {
  const d = new Date(dateUtcMs)
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const doy = Math.floor((dateUtcMs - start) / 86400000)
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600
  const gamma = ((2 * Math.PI) / 365) * (doy - 1 + (hour - 12) / 24)
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
  const decl =
    0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma)
  const tst = hour * 60 + eqTime + 4 * lng
  const ha = ((tst / 4 - 180) * D2R) % (2 * Math.PI)
  const latR = lat * D2R
  const cosAlt = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha)
  const altitude = Math.asin(Math.min(1, Math.max(-1, cosAlt))) * R2D
  const azRad = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR))
  const azimuth = (azRad * R2D + 180 + 360) % 360
  return { altitude, azimuth }
}

type Season = 'summer' | 'equinox' | 'winter'
const SEASONS: Record<Season, { month: number; day: number; label: string; tz: number }> = {
  summer: { month: 5, day: 21, label: 'Summer', tz: -6 },
  equinox: { month: 2, day: 20, label: 'Spring / Fall', tz: -6 },
  winter: { month: 11, day: 21, label: 'Winter', tz: -7 },
}

interface Terrain {
  originLat: number
  originLng: number
  latStep: number
  lngStep: number
  rows: number
  cols: number
  z: number[][]
  centroidM: number
}

interface LotVisualizerProps {
  lotName: string
  center: { lat: number; lng: number }
  polygon: number[][] // [lng,lat][]
  facing: string | null
}

const EYE_M = 1.7

export default function LotVisualizer({ lotName, center, polygon, facing }: LotVisualizerProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  // A cold terrain build can take ~20-40s server-side (DEM fetch). The first
  // attempt may die on a proxy timeout while the server keeps working, so
  // retry several times — later attempts join the in-flight build or hit a
  // warm cache and return in milliseconds.
  const terrainQ = trpc.lots.terrain3d.useQuery(
    { lotName },
    {
      staleTime: 24 * 3600 * 1000,
      retry: 4,
      retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 8000),
    }
  )
  const terrain = terrainQ.data as Terrain | undefined

  const [planId, setPlanId] = useState(homePlans[0].id)
  const [season, setSeason] = useState<Season>('summer')
  const [minutes, setMinutes] = useState(17 * 60)
  const [drivewayM, setDrivewayM] = useState(0)

  /* ---- static scene data ---- */
  const frame: LocalFrame = useMemo(() => makeFrame(center.lat, center.lng), [center])
  const lotRing = useMemo(() => ringToLocal(polygon, frame), [polygon, frame])
  const buildable = useMemo(() => insetRing(lotRing, 6 * FT_TO_M * 4), [lotRing]) // ~24ft setback
  const frontMid = useMemo(() => frontEdgeMidpoint(lotRing, facing), [lotRing, facing])
  const defaultPad = useMemo(() => ringCentroid(buildable), [buildable])

  // sun for lighting
  const seasonInfo = SEASONS[season]
  const sun = useMemo(() => {
    const year = new Date().getFullYear()
    const utcMs = Date.UTC(year, seasonInfo.month, seasonInfo.day) + (minutes - seasonInfo.tz * 60) * 60000
    return sunPosition(utcMs, center.lat, center.lng)
  }, [season, minutes, seasonInfo, center])

  /* ---- three.js scene, built once terrain arrives ---- */
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    houseAnchor: THREE.Group
    driveway: THREE.Mesh
    sun: THREE.DirectionalLight
    hemi: THREE.HemisphereLight
    rayGround: THREE.Mesh
    keys: Record<string, boolean>
    dragging: boolean
    mode: 'walk' | 'moveHouse'
    groundAt: (x: number, z: number) => number
  } | null>(null)

  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<'walk' | 'moveHouse'>('walk')
  const [imageryOn, setImageryOn] = useState(false)

  useEffect(() => {
    if (!terrain || !hostRef.current) return

    const host = hostRef.current
    const W = host.clientWidth
    const H = host.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87a5c4)
    scene.fog = new THREE.Fog(0x87a5c4, 180, 700)

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000)

    /* ---- terrain mesh ----
     * Scene space == the local tangent frame (meters; +x east, +z south,
     * origin at the lot centroid). Grid row 0 is the SOUTH edge (lats
     * ascend northward), so z decreases as r increases. */
    const { rows, cols } = terrain
    const geoT = new THREE.PlaneGeometry(1, 1, cols - 1, rows - 1) // resized below
    const pos = geoT.attributes.position as THREE.BufferAttribute
    const dxM = terrain.lngStep * frame.mPerDegLng
    const dzM = terrain.latStep * frame.mPerDegLat
    const [ox, oz] = frame.toLocal(terrain.originLat, terrain.originLng) // SW corner in local coords
    // ground height (relative to lot centroid) at any local (x, z); nearest cell
    const groundAt = (x: number, z: number): number => {
      const cIdx = Math.round((x - ox) / dxM)
      const rIdx = Math.round((oz - z) / dzM)
      if (rIdx >= 0 && rIdx < rows && cIdx >= 0 && cIdx < cols) {
        return terrain.z[rIdx][cIdx] - terrain.centroidM
      }
      return 0
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const x = ox + c * dxM
        const z = oz - r * dzM // row 0 = south edge (+z), rows ascend north
        const y = terrain.z[r][c] - terrain.centroidM
        pos.setXYZ(i, x, y, z)
      }
    }
    geoT.computeVertexNormals()
    // vertices were remapped into the XZ plane by hand, so triangle winding
    // can face down — render both sides (shader flips normals automatically)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x9a8f76, roughness: 1, side: THREE.DoubleSide })
    const ground = new THREE.Mesh(geoT, groundMat)
    ground.receiveShadow = true
    scene.add(ground)

    /* ---- drape real aerial photography over the terrain (async) ---- */
    const gridBbox = {
      south: terrain.originLat,
      west: terrain.originLng,
      north: terrain.originLat + (rows - 1) * terrain.latStep,
      east: terrain.originLng + (cols - 1) * terrain.lngStep,
    }
    let cancelled = false
    void loadAerialTexture(gridBbox).then((aerial) => {
      if (!aerial || cancelled) return
      const uv = geoT.attributes.uv as THREE.BufferAttribute
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const lat = terrain.originLat + r * terrain.latStep
          const lng = terrain.originLng + c * terrain.lngStep
          const [u, v] = aerialUV(lat, lng, aerial.bbox)
          uv.setXY(i, u, v)
        }
      }
      uv.needsUpdate = true
      groundMat.map = aerial.texture
      groundMat.color.set(0xffffff) // neutral — let the photo show through
      groundMat.needsUpdate = true
      setImageryOn(true)
    })

    // invisible larger ray target for house dragging
    const rayGround = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    rayGround.rotation.x = -Math.PI / 2
    scene.add(rayGround)

    /* ---- lot boundary + buildable zone (draped over the terrain) ---- */
    const boundaryPts = lotRing.map(([x, z]) => new THREE.Vector3(x, groundAt(x, z) + 0.25, z))
    boundaryPts.push(boundaryPts[0].clone())
    const boundary = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(boundaryPts),
      new THREE.LineBasicMaterial({ color: 0xf2b04a })
    )
    scene.add(boundary)

    const bShape = new THREE.Shape(buildable.map(([x, z]) => new THREE.Vector2(x, z)))
    const bGeo = new THREE.ShapeGeometry(bShape)
    bGeo.rotateX(Math.PI / 2) // shape (x, y) -> ground plane (x, z)
    const bPos = bGeo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < bPos.count; i++) {
      bPos.setY(i, groundAt(bPos.getX(i), bPos.getZ(i)) + 0.22)
    }
    const bMesh = new THREE.Mesh(
      bGeo,
      new THREE.MeshBasicMaterial({ color: 0xf2b04a, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
    )
    scene.add(bMesh)

    /* ---- house anchor ---- */
    const houseAnchor = new THREE.Group()
    scene.add(houseAnchor)

    /* ---- driveway ---- */
    const driveway = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x5a5a5c, roughness: 1 })
    )
    driveway.receiveShadow = true
    scene.add(driveway)

    /* ---- lights ---- */
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.4)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.set(2048, 2048)
    sunLight.shadow.camera.left = -120
    sunLight.shadow.camera.right = 120
    sunLight.shadow.camera.top = 120
    sunLight.shadow.camera.bottom = -120
    sunLight.shadow.camera.far = 800
    scene.add(sunLight)
    scene.add(sunLight.target)
    const hemi = new THREE.HemisphereLight(0xbdd2e8, 0x6a5f4c, 0.9)
    scene.add(hemi)

    /* ---- starting camera: on the street, eye height, facing the lot ---- */
    const [fx, fz] = frontMid
    // lot centroid is the frame origin (0, 0) in scene coords
    const ccx = 0, ccz = 0
    // stand a few meters outside the lot on the street side
    const dirX = fx - ccx, dirZ = fz - ccz
    const dLen = Math.hypot(dirX, dirZ) || 1
    const camX = fx + (dirX / dLen) * 6
    const camZ = fz + (dirZ / dLen) * 6
    camera.position.set(camX, groundAt(camX, camZ) + EYE_M, camZ)
    camera.lookAt(ccx, groundAt(ccx, ccz) + EYE_M * 0.7, ccz)

    sceneRef.current = {
      renderer, scene, camera, houseAnchor, driveway,
      sun: sunLight, hemi, rayGround,
      keys: {}, dragging: false, mode: 'walk',
      groundAt,
    }

    /* ---- input ---- */
    const onKey = (e: KeyboardEvent, down: boolean) => {
      sceneRef.current && (sceneRef.current.keys[e.key.toLowerCase()] = down)
    }
    const kd = (e: KeyboardEvent) => onKey(e, true)
    const ku = (e: KeyboardEvent) => onKey(e, false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let lastX = 0, lastY = 0
    let yaw = Math.atan2(ccx - camX, ccz - camZ)
    let pitch = -0.05

    const onDown = (e: PointerEvent) => {
      if (!sceneRef.current) return
      lastX = e.clientX; lastY = e.clientY
      if (sceneRef.current.mode === 'moveHouse') {
        sceneRef.current.dragging = true
      }
      renderer.domElement.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      const s = sceneRef.current
      if (!s) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX; lastY = e.clientY
      if (s.mode === 'walk' && e.buttons) {
        yaw -= dx * 0.004
        pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.003))
      } else if (s.mode === 'moveHouse' && s.dragging) {
        // pointer coords are viewport-relative; NDC must be canvas-relative
        const rect = renderer.domElement.getBoundingClientRect()
        ndc.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        )
        raycaster.setFromCamera(ndc, s.camera)
        const hit = raycaster.intersectObject(s.rayGround)[0]
        if (hit) {
          const px = hit.point.x, pz = hit.point.z
          // keep inside buildable zone
          if (pointInRingXZ(px, pz, buildable)) {
            s.houseAnchor.position.set(px, groundAt(px, pz), pz)
          }
        }
      }
    }
    const onUp = () => { if (sceneRef.current) sceneRef.current.dragging = false }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)

    /* ---- resize ---- */
    const onResize = () => {
      const w = host.clientWidth, h = host.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(host)

    /* ---- loop ---- */
    let raf = 0
    const clock = new THREE.Clock()
    const animate = () => {
      const s = sceneRef.current
      if (s) {
        const dt = Math.min(clock.getDelta(), 0.05)
        // walk movement (WASD / arrows) in the camera's facing direction
        const sp = 8 * dt
        const k = s.keys
        const fwd = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0)
        const strafe = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0)
        if (s.mode === 'walk' && (fwd || strafe)) {
          const sin = Math.sin(yaw), cos = Math.cos(yaw)
          s.camera.position.x += (sin * fwd + cos * strafe) * sp
          s.camera.position.z += (cos * fwd - sin * strafe) * sp
        }
        // keep camera at eye height above ground (sample nearest grid)
        const groundY = groundAt(s.camera.position.x, s.camera.position.z)
        s.camera.position.y += ((groundY + EYE_M) - s.camera.position.y) * 0.3

        // look direction
        const lookX = s.camera.position.x + Math.sin(yaw) * Math.cos(pitch)
        const lookY = s.camera.position.y + Math.sin(pitch)
        const lookZ = s.camera.position.z + Math.cos(yaw) * Math.cos(pitch)
        s.camera.lookAt(lookX, lookY, lookZ)

        // driveway from street front to house front
        const hx = s.houseAnchor.position.x, hz = s.houseAnchor.position.z
        const ddx = fx - hx, ddz = fz - hz
        const dLenNow = Math.hypot(ddx, ddz)
        s.driveway.position.set(
          (hx + fx) / 2,
          groundAt((hx + fx) / 2, (hz + fz) / 2) + 0.12,
          (hz + fz) / 2
        )
        s.driveway.scale.z = Math.max(dLenNow, 0.1)
        s.driveway.rotation.y = Math.atan2(ddx, ddz)
        setDrivewayM((prev) => (Math.abs(prev - dLenNow) > 0.5 ? dLenNow : prev))

        s.renderer.render(s.scene, s.camera)
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    setReady(true)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      ro.disconnect()
      renderer.dispose()
      host.removeChild(renderer.domElement)
      sceneRef.current = null
      setReady(false)
      setImageryOn(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, lotRing, buildable, frontMid, frame])

  /* ---- swap house model when plan changes ---- */
  useEffect(() => {
    const s = sceneRef.current
    if (!s || !ready) return
    s.houseAnchor.clear()
    s.houseAnchor.add(buildHouse(planId))
    // default placement: center of the buildable zone, front toward the street
    const [hx, hz] = defaultPad
    s.houseAnchor.position.set(hx, s.groundAt(hx, hz), hz)
    s.houseAnchor.rotation.y = Math.atan2(-(frontMid[0] - hx), -(frontMid[1] - hz))
  }, [planId, ready, defaultPad, frontMid])

  /* ---- sun light from slider ---- */
  useEffect(() => {
    const s = sceneRef.current
    if (!s || !ready) return
    const alt = sun.altitude
    const az = sun.azimuth
    if (alt <= 0) {
      s.sun.intensity = 0
      s.hemi.intensity = 0.25
      s.scene.background = new THREE.Color(0x1a2433)
      s.scene.fog = new THREE.Fog(0x1a2433, 180, 700)
      return
    }
    const altR = alt * D2R
    const azR = az * D2R
    // sun direction: azimuth 0=N(-z), 90=E(+x)
    const sx = Math.sin(azR) * Math.cos(altR)
    const sy = Math.sin(altR)
    const sz = -Math.cos(azR) * Math.cos(altR)
    s.sun.position.set(sx * 300, sy * 300 + 20, sz * 300)
    s.sun.target.position.set(0, 0, 0)
    // warm at low sun
    const warm = Math.max(0, 1 - alt / 40)
    s.sun.color.setRGB(1, 1 - warm * 0.35, 1 - warm * 0.55)
    s.sun.intensity = 0.4 + Math.min(1, alt / 50) * 2.2
    s.hemi.intensity = 0.4 + Math.min(1, alt / 60) * 0.6
    const dayMix = Math.min(1, alt / 25)
    const bg = new THREE.Color().lerpColors(new THREE.Color(0x1a2433), new THREE.Color(0x87a5c4), dayMix)
    s.scene.background = bg
    s.scene.fog = new THREE.Fog(bg, 180, 700)
  }, [sun, ready])

  /* ---- mode sync ---- */
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.mode = mode
  }, [mode])

  const sliderLabel = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  const fp = houseFootprint(planId)
  const plan = homePlans.find((p) => p.id === planId)

  return (
    <div style={{ borderBottom: '1px solid #000000', backgroundColor: '#0b0b0b' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px clamp(24px, 4vw, 60px)' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
          Visualize your build · Lot {lotName}
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '24px', maxWidth: '680px', lineHeight: 1.6 }}>
          Stand on the street in front of Lot {lotName}. Drag to look around, use W A S D to walk.
          Switch to <em>Move house</em> to drag the home where you want it — the driveway and its
          length update as you do. Move the sun to see real shadows.
        </p>

        {/* viewport */}
        <div style={{ position: 'relative', width: '100%', height: 'clamp(420px, 62vh, 620px)', backgroundColor: '#111' }}>
          {terrainQ.isLoading && (
            <CenteredNote>
              Building the lot in 3D…
              <span style={{ display: 'block', marginTop: '8px', letterSpacing: '0.04em', textTransform: 'none' }}>
                First build fetches real elevation data — can take up to a minute.
              </span>
            </CenteredNote>
          )}
          {terrainQ.isError && (
            <CenteredNote>
              3D view is taking longer than usual.
              <button
                onClick={() => terrainQ.refetch()}
                style={{
                  display: 'block', margin: '16px auto 0', padding: '10px 22px',
                  fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase',
                  border: '1px solid #f2b04a', backgroundColor: 'transparent',
                  color: '#f2b04a', cursor: 'pointer',
                }}
              >
                Try again
              </button>
            </CenteredNote>
          )}
          <div ref={hostRef} style={{ position: 'absolute', inset: 0, cursor: mode === 'moveHouse' ? 'grab' : 'default' }} />

          {ready && (
            <>
              {/* mode toggle */}
              <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 8 }}>
                {(['walk', 'moveHouse'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '9px 16px',
                      border: mode === m ? '1px solid #f2b04a' : '1px solid rgba(255,255,255,0.3)',
                      backgroundColor: mode === m ? 'rgba(242,176,74,0.15)' : 'rgba(11,11,11,0.6)',
                      color: mode === m ? '#f2b04a' : 'rgba(255,255,255,0.8)', cursor: 'pointer',
                    }}
                  >
                    {m === 'walk' ? 'Walk & look' : 'Move house'}
                  </button>
                ))}
              </div>

              {/* driveway readout */}
              <div style={{
                position: 'absolute', bottom: 14, right: 14,
                backgroundColor: 'rgba(11,11,11,0.78)', border: '1px solid rgba(255,255,255,0.18)',
                padding: '10px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.9)',
              }}>
                Driveway ≈ {Math.round(drivewayM / FT_TO_M)} ft
              </div>

              {/* imagery attribution */}
              {imageryOn && (
                <div style={{
                  position: 'absolute', bottom: 14, left: 14,
                  fontSize: '10px', color: 'rgba(255,255,255,0.55)',
                  backgroundColor: 'rgba(11,11,11,0.45)', padding: '4px 8px',
                }}>
                  Imagery © Esri, Maxar, Earthstar Geographics
                </div>
              )}
            </>
          )}
        </div>

        {/* controls */}
        <div style={{ marginTop: '24px', display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', alignItems: 'start' }}>
          {/* plan picker */}
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Home plan</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {homePlans.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  style={{
                    fontSize: '12px', padding: '9px 16px',
                    border: planId === p.id ? '1px solid #f2b04a' : '1px solid rgba(255,255,255,0.25)',
                    backgroundColor: planId === p.id ? 'rgba(242,176,74,0.12)' : 'transparent',
                    color: planId === p.id ? '#f2b04a' : 'rgba(255,255,255,0.75)', cursor: 'pointer',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {plan && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '10px', lineHeight: 1.5 }}>
                {plan.livingArea} · footprint {Math.round(fp.wM / FT_TO_M)}×{Math.round(fp.dM / FT_TO_M)} ft · {plan.builder}
              </p>
            )}
          </div>

          {/* sun controls */}
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Sunlight</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {(Object.keys(SEASONS) as Season[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  style={{
                    fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 14px',
                    border: season === s ? '1px solid #f2b04a' : '1px solid rgba(255,255,255,0.25)',
                    backgroundColor: season === s ? 'rgba(242,176,74,0.12)' : 'transparent',
                    color: season === s ? '#f2b04a' : 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  }}
                >
                  {SEASONS[s].label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: '#f2b04a', fontVariantNumeric: 'tabular-nums', minWidth: '46px' }}>{sliderLabel}</span>
              <input type="range" min={4 * 60} max={22 * 60} step={15} value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#f2b04a' }} />
            </div>
          </div>

          {/* how to */}
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>How to explore</p>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
              <li><strong>Drag</strong> to look around</li>
              <li><strong>W A S D / arrows</strong> to walk</li>
              <li><strong>Move house</strong> mode: drag the home on the lot</li>
              <li>Slide the sun to see shadows at golden hour</li>
            </ul>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '18px', lineHeight: 1.6 }}>
          Approximate massing of each Blackstone plan on Lot {lotName}'s real terrain and boundary.
          House models are simplified stand-ins — not the builder's final architecture — meant to
          convey scale, placement, and sun. Setback zone and driveway length are estimates.
        </p>
      </div>
    </div>
  )
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '0 32px', color: 'rgba(255,255,255,0.45)', fontSize: '13px',
      letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.8, zIndex: 2,
    }}>
      {children}
    </div>
  )
}
