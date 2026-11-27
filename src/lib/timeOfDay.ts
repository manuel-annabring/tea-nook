// The pure blend between the two time-of-day presets (SPEC section 6). No scene objects, no DOM: `src/scene/` damps
// one blend factor, calls `blendTimeValues` and copies the result into lights, materials and CSS.

import { Color, MathUtils, SRGBColorSpace, Vector3 } from 'three'
import type { LightPreset } from '../config/look.ts'
import { sunAnglesFromPosition, sunPositionInto } from './sunAngles.ts'

export type TimeOfDay = 'morning' | 'evening'

/** The blend factor each time of day heads for. */
export const TIME_BLEND: Readonly<Record<TimeOfDay, number>> = { morning: 0, evening: 1 }

/**
 * A preset in the form the scene uses it: light and material colours as `Color` (linear working space, so blending
 * them is blending light), the sun as angles plus distance (so it moves on an arc and keeps its distance), the page
 * background as sRGB components (blended like CSS `color-mix(in srgb, ...)`, so canvas and page stay identical).
 * Mutable: the dev panel edits the compiled presets, and the live values are overwritten every frame.
 */
export interface TimeValues {
  sunAzimuth: number
  sunAltitude: number
  sunDistance: number
  /** Derived from the three values above; the direction from it to the world origin is the ray direction (`beamDirectionInto`). */
  sunPosition: Vector3
  sunColor: Color
  sunIntensity: number
  fillSkyColor: Color
  fillGroundColor: Color
  fillIntensity: number
  frontFillColor: Color
  frontFillIntensity: number
  frontFillPosition: Vector3
  lampColor: Color
  lampIntensity: number
  lampGlowColor: Color
  lampGlow: number
  skyColor: Color
  skyGlow: number
  bagGlow: number
  steamTint: Color
  steamOpacity: number
  /** Opacity of the window light rays (`Rays`). */
  rayStrength: number
  /** Brightness of a dust mote inside the window beam (`Dust`). */
  dustStrength: number
  /** sRGB components 0..1 (x = red, y = green, z = blue). */
  pageBackground: Vector3
}

export function createTimeValues(): TimeValues {
  return {
    sunAzimuth: 0,
    sunAltitude: 0,
    sunDistance: 1,
    sunPosition: new Vector3(),
    sunColor: new Color(),
    sunIntensity: 0,
    fillSkyColor: new Color(),
    fillGroundColor: new Color(),
    fillIntensity: 0,
    frontFillColor: new Color(),
    frontFillIntensity: 0,
    frontFillPosition: new Vector3(),
    lampColor: new Color(),
    lampIntensity: 0,
    lampGlowColor: new Color(),
    lampGlow: 0,
    skyColor: new Color(),
    skyGlow: 0,
    bagGlow: 0,
    steamTint: new Color(),
    steamOpacity: 1,
    rayStrength: 0,
    dustStrength: 0,
    pageBackground: new Vector3(),
  }
}

/** The preset values that can be changed on their own (dev panel and `__nook.setLights`). Colours are sRGB hex. */
export interface TimePatch {
  sunAzimuth: number
  sunAltitude: number
  sunIntensity: number
  sunColor: string
  hemisphereIntensity: number
  hemisphereSkyColor: string
  hemisphereGroundColor: string
  frontIntensity: number
  frontColor: string
  lampIntensity: number
  lampColor: string
  lampGlow: number
  lampGlowColor: string
  skyColor: string
  skyGlow: number
  bagGlow: number
  steamTint: string
  steamOpacity: number
  rayStrength: number
  dustStrength: number
}

/** Applies the given fields to a compiled preset (on demand, not per frame). */
export function patchTimeValues(values: TimeValues, patch: Partial<TimePatch>): void {
  const num = (v: number | undefined, current: number) => v ?? current
  const color = (v: string | undefined, target: Color) => {
    if (v !== undefined) target.set(v)
  }
  values.sunAzimuth = num(patch.sunAzimuth, values.sunAzimuth)
  values.sunAltitude = num(patch.sunAltitude, values.sunAltitude)
  values.sunIntensity = num(patch.sunIntensity, values.sunIntensity)
  values.fillIntensity = num(patch.hemisphereIntensity, values.fillIntensity)
  values.frontFillIntensity = num(patch.frontIntensity, values.frontFillIntensity)
  values.lampIntensity = num(patch.lampIntensity, values.lampIntensity)
  values.lampGlow = num(patch.lampGlow, values.lampGlow)
  values.skyGlow = num(patch.skyGlow, values.skyGlow)
  values.bagGlow = num(patch.bagGlow, values.bagGlow)
  values.steamOpacity = num(patch.steamOpacity, values.steamOpacity)
  values.rayStrength = num(patch.rayStrength, values.rayStrength)
  values.dustStrength = num(patch.dustStrength, values.dustStrength)
  color(patch.sunColor, values.sunColor)
  color(patch.hemisphereSkyColor, values.fillSkyColor)
  color(patch.hemisphereGroundColor, values.fillGroundColor)
  color(patch.frontColor, values.frontFillColor)
  color(patch.lampColor, values.lampColor)
  color(patch.lampGlowColor, values.lampGlowColor)
  color(patch.skyColor, values.skyColor)
  color(patch.steamTint, values.steamTint)
  sunPositionInto(values.sunPosition, values.sunAzimuth, values.sunAltitude, values.sunDistance)
}

/** The editable fields of a compiled preset, in the shape `patchTimeValues` takes. */
export function readTimeValues(values: TimeValues): TimePatch {
  const hex = (c: Color) => `#${c.getHexString()}`
  return {
    sunAzimuth: values.sunAzimuth,
    sunAltitude: values.sunAltitude,
    sunIntensity: values.sunIntensity,
    sunColor: hex(values.sunColor),
    hemisphereIntensity: values.fillIntensity,
    hemisphereSkyColor: hex(values.fillSkyColor),
    hemisphereGroundColor: hex(values.fillGroundColor),
    frontIntensity: values.frontFillIntensity,
    frontColor: hex(values.frontFillColor),
    lampIntensity: values.lampIntensity,
    lampColor: hex(values.lampColor),
    lampGlow: values.lampGlow,
    lampGlowColor: hex(values.lampGlowColor),
    skyColor: hex(values.skyColor),
    skyGlow: values.skyGlow,
    bagGlow: values.bagGlow,
    steamTint: hex(values.steamTint),
    steamOpacity: values.steamOpacity,
    rayStrength: values.rayStrength,
    dustStrength: values.dustStrength,
  }
}

const scratchColor = new Color()

/** Turns a preset of `look.ts` into blendable values (once per preset). */
export function compileTimePreset(preset: LightPreset): TimeValues {
  const values = createTimeValues()
  const angles = sunAnglesFromPosition(preset.sunPosition)
  values.sunDistance = Math.hypot(...preset.sunPosition)
  values.frontFillPosition.set(...preset.frontFillPosition)
  scratchColor.set(preset.pageBackground).getRGB(scratchColor, SRGBColorSpace)
  values.pageBackground.set(scratchColor.r, scratchColor.g, scratchColor.b)
  patchTimeValues(values, {
    sunAzimuth: angles.azimuth,
    sunAltitude: angles.altitude,
    sunIntensity: preset.sunIntensity,
    sunColor: preset.sunColor,
    hemisphereIntensity: preset.fillIntensity,
    hemisphereSkyColor: preset.fillSkyColor,
    hemisphereGroundColor: preset.fillGroundColor,
    frontIntensity: preset.frontFillIntensity,
    frontColor: preset.frontFillColor,
    lampIntensity: preset.lampIntensity,
    lampColor: preset.lampColor,
    lampGlow: preset.lampGlow,
    lampGlowColor: preset.lampGlowColor,
    skyColor: preset.skyColor,
    skyGlow: preset.skyGlow,
    bagGlow: preset.bagGlow,
    steamTint: preset.steamTint,
    steamOpacity: preset.steamOpacity,
    rayStrength: preset.rayStrength,
    dustStrength: preset.dustStrength,
  })
  return values
}

/** Interpolates an angle in degrees the short way round. */
function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((((b - a + 180) % 360) + 360) % 360) - 180
  return a + delta * t
}

/**
 * Writes the mix of `from` (t = 0) and `to` (t = 1) into `out` and returns it. Allocates nothing. Every field of
 * `TimeValues` is derived from `t` here and nowhere else (add new ones, such as a ray strength, in this function, in
 * `TimeValues` and in `LightPreset`).
 */
export function blendTimeValues(from: TimeValues, to: TimeValues, t: number, out: TimeValues): TimeValues {
  const { lerp } = MathUtils
  out.sunAzimuth = lerpAngle(from.sunAzimuth, to.sunAzimuth, t)
  out.sunAltitude = lerp(from.sunAltitude, to.sunAltitude, t)
  out.sunDistance = lerp(from.sunDistance, to.sunDistance, t)
  sunPositionInto(out.sunPosition, out.sunAzimuth, out.sunAltitude, out.sunDistance)
  out.sunColor.lerpColors(from.sunColor, to.sunColor, t)
  out.sunIntensity = lerp(from.sunIntensity, to.sunIntensity, t)
  out.fillSkyColor.lerpColors(from.fillSkyColor, to.fillSkyColor, t)
  out.fillGroundColor.lerpColors(from.fillGroundColor, to.fillGroundColor, t)
  out.fillIntensity = lerp(from.fillIntensity, to.fillIntensity, t)
  out.frontFillColor.lerpColors(from.frontFillColor, to.frontFillColor, t)
  out.frontFillIntensity = lerp(from.frontFillIntensity, to.frontFillIntensity, t)
  out.frontFillPosition.lerpVectors(from.frontFillPosition, to.frontFillPosition, t)
  out.lampColor.lerpColors(from.lampColor, to.lampColor, t)
  out.lampIntensity = lerp(from.lampIntensity, to.lampIntensity, t)
  out.lampGlowColor.lerpColors(from.lampGlowColor, to.lampGlowColor, t)
  out.lampGlow = lerp(from.lampGlow, to.lampGlow, t)
  out.skyColor.lerpColors(from.skyColor, to.skyColor, t)
  out.skyGlow = lerp(from.skyGlow, to.skyGlow, t)
  out.bagGlow = lerp(from.bagGlow, to.bagGlow, t)
  out.steamTint.lerpColors(from.steamTint, to.steamTint, t)
  out.steamOpacity = lerp(from.steamOpacity, to.steamOpacity, t)
  out.rayStrength = lerp(from.rayStrength, to.rayStrength, t)
  out.dustStrength = lerp(from.dustStrength, to.dustStrength, t)
  out.pageBackground.lerpVectors(from.pageBackground, to.pageBackground, t)
  return out
}

export interface BlendTiming {
  /** `MathUtils.damp` lambda. */
  damping: number
  /** Largest time step in seconds that is used. */
  maxDelta: number
  /** Distance to the target below which the blend is set to the target. */
  snap: number
}

/** One frame of the damped blend factor: moves `current` towards `target` and ends exactly on it. */
export function stepTimeBlend(current: number, target: number, delta: number, timing: BlendTiming): number {
  const next = MathUtils.damp(current, target, timing.damping, Math.min(delta, timing.maxDelta))
  return Math.abs(target - next) < timing.snap ? target : next
}

/**
 * Blend factor for the overlay text: 0 below the switch window, 1 above it, a smoothstep in between. See `TIME_OF_DAY`
 * in `look.ts` for why the text does not follow the page linearly.
 */
export function textBlend(t: number, centre: number, width: number): number {
  return MathUtils.smoothstep(t, centre - width / 2, centre + width / 2)
}
