import * as THREE from 'three'

/** Prefer the Phase 3 drone-derived sky when present; fall back to a painted clear sky. */
const DRONE_SKY_URL = '/studio/phase3-sample/sky-equirect.jpg'

function paintProceduralSky(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
  g.addColorStop(0, '#3d7cc9')
  g.addColorStop(0.42, '#6ea8e0')
  g.addColorStop(0.52, '#c5daf0')
  g.addColorStop(0.58, '#e8dcc4')
  g.addColorStop(1, '#c4b89a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const sx = canvas.width * 0.72
  const sy = canvas.height * 0.38
  const sun = ctx.createRadialGradient(sx, sy, 2, sx, sy, 90)
  sun.addColorStop(0, 'rgba(255,250,230,0.95)')
  sun.addColorStop(0.15, 'rgba(255,236,180,0.55)')
  sun.addColorStop(1, 'rgba(255,236,180,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * Clear sky dome for Lot Studio / Neighborhood Explorer.
 * Inside-out equirect sphere so street-level angles show sky at the horizon
 * like the Phase 3 drone footage — without gray distance fog.
 */
export function makeClearSky(radius = 2400): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 48, 32)
  const mat = new THREE.MeshBasicMaterial({
    map: paintProceduralSky(),
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.name = 'clearSky'
  mesh.frustumCulled = false

  // Upgrade to drone-sampled sky when the asset is available.
  new THREE.TextureLoader().load(
    DRONE_SKY_URL,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.mapping = THREE.EquirectangularReflectionMapping
      mat.map?.dispose()
      mat.map = tex
      mat.needsUpdate = true
    },
    undefined,
    () => {
      /* keep procedural sky */
    }
  )

  return mesh
}

/** Dispose sky mesh created by makeClearSky. */
export function disposeSky(sky: THREE.Mesh) {
  sky.geometry.dispose()
  const mat = sky.material as THREE.MeshBasicMaterial
  mat.map?.dispose()
  mat.dispose()
}
