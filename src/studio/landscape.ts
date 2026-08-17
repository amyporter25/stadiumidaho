import * as THREE from 'three'
import type { PlantKind } from './costs'

/**
 * Lightweight procedural landscaping props for Lot Studio.
 * Not botanical accuracy — enough volume and color that a yard
 * reads as "planted" next to the house massing.
 */

function leafMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
  })
}

function trunkMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x5c4030, roughness: 0.95 })
}

export function buildPlant(kind: PlantKind): THREE.Group {
  const g = new THREE.Group()
  g.name = `plant-${kind}`
  g.userData.plantKind = kind

  if (kind === 'tree') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 2.2, 8),
      trunkMat()
    )
    trunk.position.y = 1.1
    trunk.castShadow = true
    g.add(trunk)
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 10),
      leafMat(0x3f6b3a)
    )
    canopy.position.y = 3.2
    canopy.scale.set(1.15, 0.95, 1.1)
    canopy.castShadow = true
    g.add(canopy)
  } else if (kind === 'evergreen') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 1.4, 8),
      trunkMat()
    )
    trunk.position.y = 0.7
    trunk.castShadow = true
    g.add(trunk)
    const tiers = [
      { y: 1.6, r: 1.35, h: 1.6 },
      { y: 2.7, r: 1.0, h: 1.4 },
      { y: 3.6, r: 0.65, h: 1.2 },
    ]
    for (const t of tiers) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(t.r, t.h, 10),
        leafMat(0x2a4a32)
      )
      cone.position.y = t.y
      cone.castShadow = true
      g.add(cone)
    }
  } else if (kind === 'shrub') {
    for (const [x, z, s] of [
      [0, 0, 1],
      [0.45, 0.2, 0.75],
      [-0.4, -0.15, 0.7],
    ] as const) {
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.55 * s, 10, 8),
        leafMat(0x4a7a3e)
      )
      bush.position.set(x, 0.45 * s, z)
      bush.scale.y = 0.85
      bush.castShadow = true
      g.add(bush)
    }
  } else {
    // lawn patch — soft green disc
    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 24),
      new THREE.MeshStandardMaterial({
        color: 0x5a8f45,
        roughness: 1,
        metalness: 0,
      })
    )
    lawn.rotation.x = -Math.PI / 2
    lawn.position.y = 0.04
    lawn.receiveShadow = true
    g.add(lawn)
  }

  return g
}
