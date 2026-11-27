import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { LIGHT_PRESETS, RAYS } from '../config/look.ts'
import {
  apertureInto,
  beamCoordinatesInto,
  beamDirectionInto,
  beamVisibility,
  createBeamWindow,
  crossProfile,
  endFade,
  isInBeam,
  lengthFade,
  mullionFade,
  rayEndDistance,
  type BeamWindow,
} from './beam.ts'
import { ROOM_SURFACES, WINDOW_FRAME } from './roomSurfaces.ts'
import { blendTimeValues, compileTimePreset, createTimeValues } from './timeOfDay.ts'

const MAX = RAYS.reachEnd
/** `Rays_Origin` and the `Window_Glass` bounds as the model has them (the app reads both from the model). */
const WINDOW: BeamWindow = { x: -0.31, y: 0.23, z: 0, halfHeight: 0.15, halfWidth: 0.18 }

const morning = compileTimePreset(LIGHT_PRESETS.morning)
const evening = compileTimePreset(LIGHT_PRESETS.evening)
const PRESETS = [
  ['morning', morning],
  ['evening', evening],
] as const

const direction = (sunPosition: Vector3) => beamDirectionInto(new Vector3(), sunPosition)
const end = (o: Vector3, d: Vector3, max = 10) => o.clone().addScaledVector(d, rayEndDistance(o.x, o.y, o.z, d, ROOM_SURFACES, max))

describe('beam direction', () => {
  it.each(PRESETS)('points from the %s sun position to the world origin', (_, preset) => {
    const d = direction(preset.sunPosition)
    expect(d.length()).toBeCloseTo(1, 10)
    // Walking from the sun along the direction, as far as the sun is away, ends at the origin.
    const arrival = preset.sunPosition.clone().addScaledVector(d, preset.sunPosition.length())
    expect(arrival.length()).toBeCloseTo(0, 10)
    // The beam enters through the window (towards +x) and goes down.
    expect(d.x).toBeGreaterThan(0.5)
    expect(d.y).toBeLessThan(-0.2)
  })

  it('follows the sun of the live blend', () => {
    const halfway = blendTimeValues(morning, evening, 0.5, createTimeValues())
    const d = direction(halfway.sunPosition)
    expect(halfway.sunPosition.clone().normalize().add(d).length()).toBeCloseTo(0, 10)
    expect(d.angleTo(direction(morning.sunPosition))).toBeGreaterThan(0.1)
    expect(d.angleTo(direction(evening.sunPosition))).toBeGreaterThan(0.1)
  })

  it('fades the beam out when the sun does not come through the window', () => {
    for (const [, preset] of PRESETS) expect(beamVisibility(direction(preset.sunPosition), ...RAYS.visibleFrom)).toBe(1)
    expect(beamVisibility(direction(new Vector3(1, 1, 0)), ...RAYS.visibleFrom)).toBe(0)
    expect(beamVisibility(direction(new Vector3(0, 1, 1)), ...RAYS.visibleFrom)).toBe(0)
  })
})

describe('where a ray ends', () => {
  const { worktop, backWall, floor } = ROOM_SURFACES

  it('on the worktop top, when that comes first (morning, from the glass centre)', () => {
    const d = direction(morning.sunPosition)
    const o = new Vector3(WINDOW.x, WINDOW.y, WINDOW.z)
    const p = end(o, d)
    expect(p.y).toBeCloseTo(worktop.y, 10)
    expect(p.x).toBeGreaterThan(worktop.xMin)
    expect(p.x).toBeLessThan(worktop.xMax)
    // The floor lies on the same ray, further on: the worktop is the first.
    expect(o.distanceTo(p)).toBeLessThan((floor.y - o.y) / d.y)
  })

  it('on the back wall, when that comes first (evening, upper back part of the window)', () => {
    const d = direction(evening.sunPosition)
    const p = end(new Vector3(WINDOW.x, 0.33, -0.12), d)
    expect(p.z).toBeCloseTo(backWall.z, 10)
    expect(p.y).toBeGreaterThan(worktop.y)
    expect(p.x).toBeLessThan(backWall.xMax)
  })

  it('on the worktop in the evening from the lower part of the window', () => {
    const p = end(new Vector3(WINDOW.x, 0.14, 0.05), direction(evening.sunPosition))
    expect(p.y).toBeCloseTo(worktop.y, 10)
    expect(Math.abs(p.z)).toBeLessThan(worktop.zMax)
  })

  it('on the floor, when the ray passes beside the worktop', () => {
    const d = new Vector3(0.5, -0.8, 0).normalize()
    const p = end(new Vector3(0.29, 0.1, 0.1), d)
    expect(p.y).toBeCloseTo(floor.y, 10)
    expect(p.x).toBeGreaterThan(worktop.xMax)
    expect(p.x).toBeLessThan(floor.xMax)
  })

  it('at the maximum length when it reaches none of the three', () => {
    const o = new Vector3(WINDOW.x, 0.35, 0.15)
    expect(rayEndDistance(o.x, o.y, o.z, direction(evening.sunPosition), ROOM_SURFACES, MAX)).toBe(MAX)
    expect(rayEndDistance(0, 0.2, 0, new Vector3(0, 1, 0), ROOM_SURFACES, MAX)).toBe(MAX)
  })

  it.each(PRESETS)('on one of the three surfaces or at the maximum for every %s ray of the window', (_, preset) => {
    const d = direction(preset.sunPosition)
    const aperture = apertureInto(createBeamWindow(), WINDOW, d, WINDOW_FRAME)
    for (let i = 0; i <= 10; i += 1) {
      for (let j = 0; j <= 10; j += 1) {
        const o = new Vector3(aperture.x, aperture.y + (i / 5 - 1) * aperture.halfHeight, aperture.z + (j / 5 - 1) * aperture.halfWidth)
        const t = rayEndDistance(o.x, o.y, o.z, d, ROOM_SURFACES, MAX)
        const p = o.clone().addScaledVector(d, t)
        const onSurface = Math.abs(p.y - worktop.y) < 1e-9 || Math.abs(p.z - backWall.z) < 1e-9 || Math.abs(p.y - floor.y) < 1e-9
        expect(onSurface || t === MAX).toBe(true)
        // Nothing is passed on the way: the ray stays above the worktop (over its footprint) and in front of the wall.
        expect(p.z).toBeGreaterThanOrEqual(backWall.z - 1e-9)
        if (p.x <= worktop.xMax) expect(p.y).toBeGreaterThanOrEqual(worktop.y - 1e-9)
      }
    }
  })
})

describe('soft end of a ray', () => {
  const { fadeOut, edgeMargin } = { fadeOut: RAYS.endFade, edgeMargin: RAYS.edgeMargin }

  it.each(PRESETS)('is full far from the surface and gone at the %s ray end', (_, preset) => {
    const d = direction(preset.sunPosition)
    const o = new Vector3(WINDOW.x, 0.2, -0.05)
    const t = rayEndDistance(o.x, o.y, o.z, d, ROOM_SURFACES, 10)
    expect(endFade(o.x, o.y, o.z, d, t - fadeOut - 0.001, ROOM_SURFACES, fadeOut, edgeMargin)).toBe(1)
    expect(endFade(o.x, o.y, o.z, d, t - fadeOut / 2, ROOM_SURFACES, fadeOut, edgeMargin)).toBeCloseTo(0.5, 6)
    expect(endFade(o.x, o.y, o.z, d, t, ROOM_SURFACES, fadeOut, edgeMargin)).toBeCloseTo(0, 10)
    expect(endFade(o.x, o.y, o.z, d, t + 0.1, ROOM_SURFACES, fadeOut, edgeMargin)).toBe(0)
  })

  it('has no step between neighbouring rays at the edge of the worktop', () => {
    const d = direction(evening.sunPosition)
    let previous: number | null = null
    // Rays from higher up reach further right; around y 0.256 they start to miss the right end of the worktop.
    for (let y = 0.2; y <= 0.32; y += 0.001) {
      const t = (y / -d.y) * 0.9
      const fade = endFade(WINDOW.x, y, 0.1, d, t, ROOM_SURFACES, fadeOut, edgeMargin)
      if (previous !== null) expect(Math.abs(fade - previous)).toBeLessThan(0.12)
      previous = fade
    }
  })
})

describe('lit opening', () => {
  it('is the glass minus the frame bars and their depth', () => {
    const d = direction(morning.sunPosition)
    const a = apertureInto(createBeamWindow(), WINDOW, d, WINDOW_FRAME)
    expect(a.halfHeight).toBeCloseTo(0.15 - 0.02 - 0.015 * (-d.y / d.x), 10)
    expect(a.halfWidth).toBeCloseTo(0.18 - 0.02 - 0.015 * Math.abs(d.z / d.x), 10)
    expect([a.x, a.y, a.z]).toEqual([WINDOW.x, WINDOW.y, WINDOW.z])
  })

  it('writes into the object it is given', () => {
    const out = createBeamWindow()
    expect(apertureInto(out, WINDOW, direction(evening.sunPosition), WINDOW_FRAME)).toBe(out)
  })
})

describe('inside the beam', () => {
  it.each(PRESETS)('a point on a %s ray from the glass centre is inside, a point beside the beam is outside', (_, preset) => {
    const d = direction(preset.sunPosition)
    const a = apertureInto(createBeamWindow(), WINDOW, d, WINDOW_FRAME)
    const length = rayEndDistance(a.x, a.y, a.z, d, ROOM_SURFACES, MAX)
    const at = (t: number) => new Vector3(a.x, a.y, a.z).addScaledVector(d, t)
    const inside = (p: Vector3) => isInBeam(p.x, p.y, p.z, a, d, ROOM_SURFACES, MAX)
    for (const share of [0.05, 0.5, 0.95]) expect(inside(at(length * share))).toBe(true)
    // Beside, above and below the beam.
    expect(inside(at(length / 2).add(new Vector3(0, 0, a.halfWidth + 0.01)))).toBe(false)
    expect(inside(at(length / 2).add(new Vector3(0, a.halfHeight + 0.01, 0)))).toBe(false)
    expect(inside(at(length / 2).add(new Vector3(0, -a.halfHeight - 0.01, 0)))).toBe(false)
    // Past the surface that ends the ray, and behind the window.
    expect(inside(at(length + 0.02))).toBe(false)
    expect(inside(at(-0.02))).toBe(false)
  })

  it('gives the window point a position is lit through', () => {
    const d = direction(evening.sunPosition)
    const out = { t: 0, y: 0, z: 0 }
    const p = new Vector3(WINDOW.x, 0.3, 0.05).addScaledVector(d, 0.2)
    expect(beamCoordinatesInto(out, p.x, p.y, p.z, WINDOW, d)).toBe(true)
    expect(out.t).toBeCloseTo(0.2, 10)
    expect(out.y).toBeCloseTo(0.3, 10)
    expect(out.z).toBeCloseTo(0.05, 10)
  })
})

describe('falloff curves', () => {
  it('softens the top and bottom of the beam to nothing', () => {
    expect(crossProfile(0, 0.25)).toBe(0)
    expect(crossProfile(1, 0.25)).toBe(0)
    expect(crossProfile(0.5, 0.25)).toBe(1)
    expect(crossProfile(0.125, 0.25)).toBeCloseTo(0.5, 10)
    expect(crossProfile(0.875, 0.25)).toBeCloseTo(0.5, 10)
  })

  it('dims the beam behind a cross bar of the window', () => {
    expect(mullionFade(0, 0.006, 0.01, 0.6)).toBeCloseTo(0.4, 10)
    expect(mullionFade(-0.006, 0.006, 0.01, 0.6)).toBeCloseTo(0.4, 10)
    expect(mullionFade(0.03, 0.006, 0.01, 0.6)).toBe(1)
  })

  it('fades in at the window and out before the reach', () => {
    expect(lengthFade(0, 0.1, 0.5, 1)).toBe(0)
    expect(lengthFade(0.3, 0.1, 0.5, 1)).toBe(1)
    expect(lengthFade(0.75, 0.1, 0.5, 1)).toBeCloseTo(0.5, 10)
    expect(lengthFade(1, 0.1, 0.5, 1)).toBe(0)
  })
})
