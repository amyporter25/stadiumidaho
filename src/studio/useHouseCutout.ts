import { useCallback, useState } from 'react'

export type CutoutStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Turns a house photo into a transparent cutout in the browser.
 * Falls back to the original image if background removal fails — placement
 * should still work; the buyer can retry with a cleaner photo.
 */
export function useHouseCutout() {
  const [status, setStatus] = useState<CutoutStatus>('idle')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const revoke = useCallback((url: string | null) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }, [])

  const processFile = useCallback(
    async (file: File) => {
      setStatus('loading')
      setError(null)

      const rawUrl = URL.createObjectURL(file)
      try {
        const { removeBackground } = await import('@imgly/background-removal')
        const blob = await removeBackground(file, {
          // Smaller model keeps first-run download tolerable on LTE.
          model: 'isnet_fp16',
          output: { format: 'image/png', quality: 0.9 },
        })
        const cutoutUrl = URL.createObjectURL(blob)
        revoke(rawUrl)
        setObjectUrl((prev) => {
          revoke(prev)
          return cutoutUrl
        })
        setStatus('ready')
      } catch (e) {
        // Still place the photo — cutout is best-effort, not a gate.
        console.warn('[studio] background removal failed; using original', e)
        setObjectUrl((prev) => {
          revoke(prev)
          return rawUrl
        })
        setStatus('ready')
        setError('Could not cut out the background — placed the original photo instead.')
      }
    },
    [revoke]
  )

  const clear = useCallback(() => {
    setObjectUrl((prev) => {
      revoke(prev)
      return null
    })
    setStatus('idle')
    setError(null)
  }, [revoke])

  return { status, objectUrl, error, processFile, clear }
}
