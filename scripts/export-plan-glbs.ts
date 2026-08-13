/**
 * Export brief-compliant builder homes to public/plans/glb/*.glb
 *
 * Run: npx tsx scripts/export-plan-glbs.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { buildBuilderHome } from '../src/components/lotVisualizer/builderHomes.ts'

// GLTFExporter expects a browser FileReader (Node 22 has Blob).
if (typeof FileReader === 'undefined') {
  class NodeFileReader {
    result: ArrayBuffer | null = null
    onloadend: ((ev?: unknown) => void) | null = null
    onerror: ((ev?: unknown) => void) | null = null
    readAsArrayBuffer(blob: Blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          this.result = buf
          this.onloadend?.(null)
        })
        .catch((err) => this.onerror?.(err))
    }
  }
  globalThis.FileReader = NodeFileReader as unknown as typeof FileReader
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/plans/glb')

function stripMaps(rootObj: THREE.Object3D): void {
  rootObj.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial
      if (sm.map) sm.map = null
    }
  })
}

function exportOne(planId: string): Promise<ArrayBuffer> {
  const house = buildBuilderHome(planId)
  stripMaps(house)
  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => {
    exporter.parse(
      house,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result)
        else reject(new Error('Expected binary GLB'))
      },
      (err) => reject(err),
      { binary: true, embedImages: false }
    )
  })
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true })
  const plans = ['whitestone-front', 'whitestone-side', 'brownstone'] as const
  for (const id of plans) {
    const buf = await exportOne(id)
    const dest = join(outDir, `${id}.glb`)
    writeFileSync(dest, Buffer.from(buf))
    const house = buildBuilderHome(id)
    const nodes = ['GarageDoorFront', 'GarageDoorSide']
      .filter((n) => house.getObjectByName(n))
      .join(', ')
    console.log(
      `${id}.glb  ${(buf.byteLength / 1024).toFixed(0)} KB  nodes: ${nodes || '(none)'}  ` +
        `${house.userData.widthM.toFixed(1)}×${house.userData.depthM.toFixed(1)} m`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
