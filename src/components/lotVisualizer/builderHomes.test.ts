import { describe, expect, it } from 'vitest'
import { FT_TO_M } from './geo'
import { annotateBuilderHome, builderHomeMeta, PLAN_GLB_URL } from './builderHomes'
import * as THREE from 'three'

describe('builderHomeMeta', () => {
  it('uses catalog footprints and garage entry', () => {
    expect(builderHomeMeta('whitestone-side').garageEntry).toBe('side')
    expect(builderHomeMeta('whitestone-front').garageEntry).toBe('front')
    expect(builderHomeMeta('brownstone').widthM).toBeCloseTo(91 * FT_TO_M)
    expect(builderHomeMeta('whitestone-side').depthM).toBeCloseTo(78 * FT_TO_M)
  })

  it('maps each studio plan to a public GLB path', () => {
    expect(PLAN_GLB_URL['whitestone-front']).toMatch(/whitestone-front\.glb/)
    expect(PLAN_GLB_URL['whitestone-side']).toMatch(/whitestone-side\.glb/)
    expect(PLAN_GLB_URL.brownstone).toMatch(/brownstone\.glb/)
  })
})

describe('annotateBuilderHome', () => {
  it('aims the front-entry driveway at street-left for Whitestone', () => {
    const house = new THREE.Group()
    annotateBuilderHome(house, 'whitestone-front', false)
    expect(house.userData.garageLocalX).toBeGreaterThan(0)
    expect(house.userData.garageLocalZ).toBeLessThan(0)
  })

  it('aims the side-entry driveway at the side wall', () => {
    const house = new THREE.Group()
    annotateBuilderHome(house, 'whitestone-side', false)
    expect(Math.abs(house.userData.garageLocalX as number)).toBeCloseTo(
      builderHomeMeta('whitestone-side').widthM / 2
    )
    expect(house.userData.garageLocalZ).toBe(0)
  })

  it('prefers a named garage node over the catalog fraction', () => {
    const house = new THREE.Group()
    const door = new THREE.Object3D()
    door.name = 'GarageDoorFront'
    door.position.set(3, 0, -8)
    house.add(door)
    house.updateMatrixWorld(true)
    annotateBuilderHome(house, 'whitestone-front', true)
    expect(house.userData.garageLocalX).toBeCloseTo(3)
    expect(house.userData.garageLocalZ).toBeCloseTo(-8)
    expect(house.userData.glbReady).toBe(true)
  })
})
