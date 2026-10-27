/** Public asset URL that respects the Vite `base` path (the site lives under /tea-nook/ on Pages). */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  return `${base}${path.replace(/^\/+/, '')}`
}
