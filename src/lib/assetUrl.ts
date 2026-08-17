/**
 * Prefix a file from `public/` with Vite’s base URL.
 *
 * GitHub Pages serves this repo at `/stadiumidaho/`, so absolute paths like
 * `/plans/foo.png` would 404 on the live preview. Local `npm run dev` keeps
 * `base` at `/`, so the same helper is a no-op there.
 */
export function assetUrl(path: string): string {
  if (!path || path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  const base = import.meta.env.BASE_URL || '/'
  const relative = path.startsWith('/') ? path.slice(1) : path
  return `${base}${relative}`
}

/** React Router basename: Vite’s BASE_URL always has a trailing slash. */
export function routerBasename(): string | undefined {
  const trimmed = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return trimmed || undefined
}
