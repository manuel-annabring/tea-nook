import { SHADOW } from '../config/look.ts'

export type ShadowMode = 'off' | 'live' | 'static'

/** The shadow mode in use: `SHADOW.mode`, or in dev the `?shadow=off|live|static` URL override (for measuring). */
export function getShadowMode(): ShadowMode {
  if (import.meta.env.DEV) {
    const param = new URLSearchParams(window.location.search).get('shadow')
    if (param === 'off' || param === 'live' || param === 'static') return param
  }
  return SHADOW.mode
}
