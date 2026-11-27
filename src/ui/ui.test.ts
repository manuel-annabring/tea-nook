import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'
import { LIGHT_PRESETS, TIME_OF_DAY, UI } from '../config/look.ts'
import { stepTimeBlend, textBlend } from '../lib/timeOfDay.ts'

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0)
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}
const cssVar = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`, 'i').exec(css)?.[1]?.trim().toLowerCase()

/** `rgba(r, g, b, a)` pill colour laid over an opaque hex colour. */
function over(rgba: string, hex: string): string {
  const [r, g, b, a] = (/rgba\(([^)]+)\)/.exec(rgba)?.[1] ?? '').split(',').map(Number)
  const under = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const mixed = [r, g, b].map((c, i) => Math.round((c ?? 0) * (a ?? 1) + (under[i] ?? 0) * (1 - (a ?? 1))))
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

describe('overlay look', () => {
  it('index.css mirrors the look.ts values of both times of day', () => {
    for (const time of ['morning', 'evening'] as const) {
      const preset = LIGHT_PRESETS[time]
      expect(cssVar(`${time}-bg`)).toBe(preset.pageBackground.toLowerCase())
      expect(cssVar(`${time}-text`)).toBe(preset.uiText.toLowerCase())
      expect(cssVar(`${time}-pill`)).toBe(preset.uiPill.toLowerCase())
    }
    expect(cssVar('ui-font')).toBe(UI.fontFamily.toLowerCase())
  })

  it('mixes the colours in use from the two sets, in sRGB, starting in the morning', () => {
    expect(cssVar('nook-bg')).toBe('color-mix(in srgb, var(--evening-bg) var(--tod-page), var(--morning-bg))')
    expect(cssVar('ui-text')).toBe('color-mix(in srgb, var(--evening-text) var(--tod-text), var(--morning-text))')
    expect(cssVar('ui-pill')).toBe('color-mix(in srgb, var(--evening-pill) var(--tod-page), var(--morning-pill))')
    expect(cssVar('tod-page')).toBe('0%')
    expect(cssVar('tod-text')).toBe('0%')
  })

  it('text reaches 4.5:1 on the page background and on the pill, in both times of day', () => {
    for (const preset of Object.values(LIGHT_PRESETS)) {
      expect(contrast(preset.uiText, preset.pageBackground)).toBeGreaterThanOrEqual(4.5)
      // The pill is translucent: the worst the canvas behind it can be is black or white.
      for (const behind of ['#000000', '#ffffff']) {
        expect(contrast(preset.uiText, over(preset.uiPill, behind))).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('is hard to read only briefly while the page changes', () => {
    const { morning, evening } = LIGHT_PRESETS
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const mix = (a: string, b: string, t: number) => {
      const to = channels(b)
      return `#${channels(a).map((c, i) => Math.round(c + ((to[i] ?? 0) - c) * t).toString(16).padStart(2, '0')).join('')}`
    }
    // Frames of a transition (60 fps) with a contrast below 3:1, at the steep text curve.
    for (const [from, to] of [
      [0, 1],
      [1, 0],
    ] as const) {
      let t: number = from
      let low = 0
      for (let frame = 0; frame < 120; frame += 1) {
        t = stepTimeBlend(t, to, 1 / 60, TIME_OF_DAY)
        const text = mix(morning.uiText, evening.uiText, textBlend(t, TIME_OF_DAY.textSwitchCentre, TIME_OF_DAY.textSwitchWidth))
        if (contrast(text, mix(morning.pageBackground, evening.pageBackground, t)) < 3) low += 1
      }
      expect(low / 60).toBeLessThanOrEqual(0.15)
    }
  })
})
