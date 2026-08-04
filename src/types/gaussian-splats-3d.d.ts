declare module '@mkkellogg/gaussian-splats-3d' {
  export interface ViewerOptions {
    cameraUp?: number[]
    initialCameraPosition?: number[]
    initialCameraLookAt?: number[]
    rootElement?: HTMLElement
    selfDrivenMode?: boolean
    useBuiltInControls?: boolean
    ignoreDevicePixelRatio?: boolean
    sharedMemoryForWorkers?: boolean
    integerBasedSort?: boolean
    dynamicScene?: boolean
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
    dispose(): Promise<void>
  }
}
