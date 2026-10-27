import { describe, expect, it } from 'vitest'
import { heightFade, pointerFalloff, pointerPush, smoothstep, STEAM_DEFAULTS, twistAngle } from './steamMath.ts'

describe('smoothstep', () => {
  it('clamps and is smooth at the midpoint', () => {
    expect(smoothstep(0, 1, -1)).toBe(0)
    expect(smoothstep(0, 1, 2)).toBe(1)
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5)
  })
})

describe('twistAngle', () => {
  it('is 0 at the base and twistMax at the top', () => {
    expect(twistAngle(0, 5, 1.6)).toBe(0)
    expect(twistAngle(1, 5, 1.6)).toBeCloseTo(5)
  })

  it('stays below the linear curve for power > 1', () => {
    expect(twistAngle(0.5, 5, 1.6)).toBeLessThan(2.5)
  })
})

describe('heightFade', () => {
  const { fadeIn, fadeOut } = STEAM_DEFAULTS

  it('is transparent at both ends', () => {
    expect(heightFade(0, fadeIn, fadeOut)).toBe(0)
    expect(heightFade(1, fadeIn, fadeOut)).toBe(0)
  })

  it('is fully opaque between fadeIn and fadeOut', () => {
    expect(heightFade(0.3, fadeIn, fadeOut)).toBe(1)
  })
})

describe('pointer push', () => {
  it('falls from 1 at the pointer to 0 at the radius', () => {
    expect(pointerFalloff(0, 0.07, 1.5)).toBe(1)
    expect(pointerFalloff(0.07, 0.07, 1.5)).toBe(0)
    expect(pointerFalloff(0.2, 0.07, 1.5)).toBe(0)
  })

  it('is strongest at the top and zero at the anchored base', () => {
    expect(pointerPush(0, 1, STEAM_DEFAULTS)).toBeCloseTo(STEAM_DEFAULTS.pointerStrength)
    expect(pointerPush(0, 0, STEAM_DEFAULTS)).toBe(0)
  })

  it('does nothing outside the radius', () => {
    expect(pointerPush(0.1, 1, STEAM_DEFAULTS)).toBe(0)
  })
})
