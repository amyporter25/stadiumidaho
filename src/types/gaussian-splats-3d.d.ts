declare module '@mkkellogg/gaussian-splats-3d' {
  import type { Group } from 'three'

  export interface ViewerOptions {
    cameraUp?: number[]
    initialCameraPosition?: number[]
    initialCameraLookAt?: number[]
    rootElement?: HTMLElement | null
    selfDrivenMode?: boolean
    useBuiltInControls?: boolean
    ignoreDevicePixelRatio?: boolean
    sharedMemoryForWorkers?: boolean
    integerBasedSort?: boolean
    dynamicScene?: boolean
    dropInMode?: boolean
    camera?: unknown
    renderer?: unknown
    /** Optional Three.js scene the viewer will render alongside the splats. */
    threeScene?: unknown
    gpuAcceleratedSort?: boolean
  }

  export interface SplatSceneOptions {
    progressiveLoad?: boolean
    showLoadingUI?: boolean
    splatAlphaRemovalThreshold?: number
    position?: number[]
    rotation?: number[]
    scale?: number[]
    onProgress?: (percent: number, label: string, status: unknown) => void
  }

  export class Viewer {
    constructor(options?: ViewerOptions)
    addSplatScene(path: string, options?: SplatSceneOptions): Promise<void>
    start(): void
    stop(): void
    update(): void
    dispose(): Promise<void>
  }

  export class DropInViewer extends Group {
    constructor(options?: ViewerOptions)
    addSplatScene(path: string, options?: SplatSceneOptions): Promise<void>
    viewer: Viewer
    dispose(): Promise<void>
  }
}
