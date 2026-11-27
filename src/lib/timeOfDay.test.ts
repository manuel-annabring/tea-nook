import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { LIGHT_PRESETS, TIME_OF_DAY } from '../config/look.ts'
import { sunAnglesFromPosition } from './sunAngles.ts'
import {
  blendTimeValues,
  compileTimePreset,
  createTimeValues,
  patchTimeValues,
  readTimeValues,
  stepTimeBlend,
  textBlend,
  type TimeValues,
} from './timeOfDay.ts'

const morning = compileTimePreset(LIGHT_PRESETS.morning)
const evening = compileTimePreset(LIGHT_PRESETS.evening)
const blendAt = (t: number) => blendTimeValues(morning, evening, t, createTimeValues())

/** Every number of a `TimeValues`, flattened, in a fixed order. */
function numbers(v: TimeValues): number[] {
  return Object.values(v).flatMap((field: unknown) => {
    if (typeof field === 'number') return [field]
    if (field instanceof Color) return [field.r, field.g, field.b]
    const { x, y, z } = field as { x: number; y: number; z: number }
    return [x, y, z]
  })
}

function expectSame(a: TimeValues, b: TimeValues): void {
  const left = numbers(a)
  const right = numbers(b)
  expect(left).toHaveLength(right.length)
  left.forEach((value, i) => expect(value).toBeCloseTo(right[i] as number, 10))
}

describe('time-of-day blend', () => {
  it('returns the morning preset at 0 and the evening preset at 1', () => {
    expectSame(blendAt(0), morning)
    expectSame(blendAt(1), evening)
  })

  it('matches the preset of look.ts at both ends', () => {
    for (const [t, preset] of [
      [0, LIGHT_PRESETS.morning],
      [1, LIGHT_PRESETS.evening],
    ] as const) {
      const v = blendAt(t)
      preset.sunPosition.forEach((c, i) => expect(v.sunPosition.getComponent(i)).toBeCloseTo(c, 6))
      expect(`#${v.sunColor.getHexString()}`).toBe(preset.sunColor.toLowerCase())
      expect(v.sunIntensity).toBe(preset.sunIntensity)
      expect(v.fillIntensity).toBe(preset.fillIntensity)
      expect(v.lampIntensity).toBe(preset.lampIntensity)
      expect(v.lampGlow).toBe(preset.lampGlow)
      expect(`#${v.skyColor.getHexString()}`).toBe(preset.skyColor.toLowerCase())
      expect(`#${v.steamTint.getHexString()}`).toBe(preset.steamTint.toLowerCase())
      // The page background is stored as sRGB components.
      const page = [v.pageBackground.x, v.pageBackground.y, v.pageBackground.z].map((c) => Math.round(c * 255))
      expect(page).toEqual([1, 3, 5].map((i) => parseInt(preset.pageBackground.slice(i, i + 2), 16)))
    }
  })

  it('puts the evening sun at azimuth -75 and elevation (altitude) 22 degrees, at the morning distance', () => {
    const position = blendAt(1).sunPosition
    const angles = sunAnglesFromPosition([position.x, position.y, position.z])
    expect(Math.abs(angles.azimuth - -75)).toBeLessThan(0.1)
    expect(Math.abs(angles.altitude - 22)).toBeLessThan(0.1)
    expect(position.length()).toBeCloseTo(blendAt(0).sunPosition.length(), 10)
    // The position written down in SPEC slice 4.0.
    expect(position.x).toBeCloseTo(-1.347, 2)
    expect(position.y).toBeCloseTo(0.563, 2)
    expect(position.z).toBeCloseTo(0.361, 2)
  })

  it('moves the sun on an arc that keeps its distance', () => {
    for (let t = 0; t <= 1; t += 0.05) expect(blendAt(t).sunPosition.length()).toBeCloseTo(morning.sunDistance, 10)
  })

  it('takes the short way round for the azimuth', () => {
    const a = compileTimePreset({ ...LIGHT_PRESETS.morning, sunPosition: [0.1, 0.5, -1] })
    const b = compileTimePreset({ ...LIGHT_PRESETS.morning, sunPosition: [-0.1, 0.5, -1] })
    const middle = blendTimeValues(a, b, 0.5, createTimeValues())
    expect(Math.abs(middle.sunAzimuth)).toBeCloseTo(180, 6)
  })

  it('changes every value monotonically', () => {
    const samples = Array.from({ length: 51 }, (_, i) => numbers(blendAt(i / 50)))
    const first = samples[0] as number[]
    const last = samples[samples.length - 1] as number[]
    first.forEach((start, k) => {
      const direction = Math.sign((last[k] as number) - start)
      for (let i = 1; i < samples.length; i += 1) {
        const step = ((samples[i] as number[])[k] as number) - ((samples[i - 1] as number[])[k] as number)
        expect(step * direction).toBeGreaterThanOrEqual(-1e-9)
      }
    })
  })

  it('writes into the given object and returns it', () => {
    const out = createTimeValues()
    const { sunColor, sunPosition } = out
    expect(blendTimeValues(morning, evening, 0.3, out)).toBe(out)
    expect(out.sunColor).toBe(sunColor)
    expect(out.sunPosition).toBe(sunPosition)
  })

  it('has the lamp off in the morning and on in the evening, and differs where the toggle must show', () => {
    expect(morning.lampIntensity).toBe(0)
    expect(morning.lampGlow).toBe(0)
    expect(evening.lampIntensity).toBeGreaterThan(0)
    expect(evening.lampGlow).toBeGreaterThan(0)
    expect(evening.skyColor.equals(morning.skyColor)).toBe(false)
    expect(evening.steamTint.equals(morning.steamTint)).toBe(false)
    expect(evening.pageBackground.equals(morning.pageBackground)).toBe(false)
    // The morning leaves the steam as it was.
    expect(morning.steamTint.equals(new Color(1, 1, 1))).toBe(true)
    expect(morning.steamOpacity).toBe(1)
  })
})

describe('editing a preset', () => {
  it('reads back what was patched and moves the sun with the angles', () => {
    const preset = compileTimePreset(LIGHT_PRESETS.evening)
    patchTimeValues(preset, { sunAzimuth: -30, lampIntensity: 0.3, skyColor: '#112233' })
    const read = readTimeValues(preset)
    expect(read.sunAzimuth).toBe(-30)
    expect(read.lampIntensity).toBe(0.3)
    expect(read.skyColor).toBe('#112233')
    expect(read.sunAltitude).toBeCloseTo(22, 6)
    expect(sunAnglesFromPosition([preset.sunPosition.x, preset.sunPosition.y, preset.sunPosition.z]).azimuth).toBeCloseTo(-30, 6)
    expect(preset.sunPosition.length()).toBeCloseTo(preset.sunDistance, 10)
  })

  it('leaves unnamed fields alone', () => {
    const preset = compileTimePreset(LIGHT_PRESETS.morning)
    const before = numbers(preset)
    patchTimeValues(preset, {})
    expect(numbers(preset)).toEqual(before)
  })
})

describe('damped blend factor', () => {
  /** Runs a transition at 60 fps and returns every value, starting with `from`. */
  function run(from: number, to: number, seconds: number, dt = 1 / 60): number[] {
    const values = [from]
    for (let i = 0; i < Math.round(seconds / dt); i += 1) values.push(stepTimeBlend(values[i] as number, to, dt, TIME_OF_DAY))
    return values
  }

  it('reaches the target within 2 s, monotonically, with no step above 25 %', () => {
    for (const [from, to] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const values = run(from, to, 2)
      expect(values[values.length - 1]).toBe(to)
      for (let i = 1; i < values.length; i += 1) {
        const step = ((values[i] as number) - (values[i - 1] as number)) * (to - from)
        expect(step).toBeGreaterThanOrEqual(0)
        expect(step).toBeLessThanOrEqual(0.25)
      }
    }
  })

  it('turns round smoothly when toggled in the middle', () => {
    const half = run(0, 1, 0.2)
    const middle = half[half.length - 1] as number
    const back = run(middle, 0, 2)
    expect(Math.abs((back[1] as number) - middle)).toBeLessThan(0.1)
    expect(back[back.length - 1]).toBe(0)
  })

  it('caps a long frame', () => {
    expect(stepTimeBlend(0, 1, 5, TIME_OF_DAY)).toBeLessThan(0.25)
  })

  it('switches the text along a steeper curve with steps below 25 % at 60 fps', () => {
    const { textSwitchCentre: c, textSwitchWidth: w } = TIME_OF_DAY
    expect(textBlend(0, c, w)).toBe(0)
    expect(textBlend(1, c, w)).toBe(1)
    for (const [from, to] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const text = run(from, to, 2).map((t) => textBlend(t, c, w))
      for (let i = 1; i < text.length; i += 1) {
        const step = ((text[i] as number) - (text[i - 1] as number)) * (to - from)
        expect(step).toBeGreaterThanOrEqual(0)
        expect(step).toBeLessThanOrEqual(0.25)
      }
    }
  })
})
