import { describe, expect, it } from 'vitest'
import css from '../index.css?raw'
import { BACKGROUND_COLOR, UI } from '../config/look.ts'

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0)
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}
const cssVar = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`, 'i').exec(css)?.[1]?.trim().toLowerCase()

describe('overlay look', () => {
  it('index.css mirrors the look.ts values', () => {
    expect(cssVar('nook-bg')).toBe(BACKGROUND_COLOR.toLowerCase())
    expect(cssVar('ui-text')).toBe(UI.text.toLowerCase())
    expect(cssVar('ui-pill')).toBe(UI.pill.toLowerCase())
    expect(cssVar('ui-font')).toBe(UI.fontFamily.toLowerCase())
  })

  it('text reaches 4.5:1 on the page background (the pill is nearly the same colour)', () => {
    expect(contrast(UI.text, BACKGROUND_COLOR)).toBeGreaterThanOrEqual(4.5)
  })
})
