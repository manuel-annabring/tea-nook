import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { DUST, LIGHT_PRESETS, RAYS } from '../config/look.ts'
import { apertureInto, beamDirectionInto, createBeamWindow, isInBeam, type BeamWindow } from './beam.ts'
import { boxFade, createDustMotes, dustBeamWeight, dustBoxFrom, dustPositionInto, type DustBeamShape } from './dust.ts'
import { ROOM_SURFACES, WINDOW_FRAME } from './roomSurfaces.ts'
import { compileTimePreset } from './timeOfDay.ts'

/** `Dust_Min`, `Dust_Max`, `Rays_Origin` and the glass bounds as the model has them (the app reads all from the model). */
const MARKER_MIN = { x: -0.28, y: -0.05, z: 0.2 }
const MARKER_MAX = { x: 0.3, y: 0.3, z: -0.15 }
const WINDOW: BeamWindow = { x: -0.31, y: 0.23, z: 0, halfHeight: 0.15, halfWidth: 0.18 }
const BOX = dustBoxFrom(MARKER_MIN, MARKER_MAX)
const SHAPE: DustBeamShape = { ...RAYS, softness: DUST.beamSoftness }

const PRESETS = [
  ['morning', compileTimePreset(LIGHT_PRESETS.morning)],
  ['evening', compileTimePreset(LIGHT_PRESETS.evening)],
] as const

describe('dust box', () => {
  it('orders the two marker corners per axis', () => {
    expect(BOX.min).toEqual({ x: -0.28, y: -0.05, z: -0.15 })
    expect(BOX.size.x).toBeCloseTo(0.58, 10)
    expect(BOX.size.y).toBeCloseTo(0.35, 10)
    expect(BOX.size.z).toBeCloseTo(0.35, 10)
  })
})

describe('dust positions', () => {
  const motes = createDustMotes(DUST)

  it('keep every mote inside the box over 60 s of simulated time', () => {
    const p = new Vector3()
    const worst = { low: Infinity, high: Infinity }
    for (let frame = 0; frame <= 60 * 60; frame += 1) {
      for (let i = 0; i < DUST.count; i += 1) {
        dustPositionInto(p, motes, i, frame / 60, BOX, DUST.wobble)
        for (const axis of ['x', 'y', 'z'] as const) {
          worst.low = Math.min(worst.low, p[axis] - BOX.min[axis])
          worst.high = Math.min(worst.high, BOX.min[axis] + BOX.size[axis] - p[axis])
        }
      }
    }
    // Smallest distance to a face over all motes and frames: never negative (beyond rounding).
    expect(worst.low).toBeGreaterThan(-1e-12)
    expect(worst.high).toBeGreaterThan(-1e-12)
  })

  it('move, and are the same for the same seed', () => {
    const a = dustPositionInto(new Vector3(), motes, 3, 0, BOX, DUST.wobble)
    const b = dustPositionInto(new Vector3(), motes, 3, 5, BOX, DUST.wobble)
    expect(a.distanceTo(b)).toBeGreaterThan(0.001)
    expect(createDustMotes(DUST)).toEqual(motes)
    expect(motes.base.length).toBe(DUST.count * 3)
  })

  it('fade out on the faces of the box, where a mote wraps around', () => {
    const centre = { x: BOX.min.x + BOX.size.x / 2, y: BOX.min.y + BOX.size.y / 2, z: BOX.min.z + BOX.size.z / 2 }
    expect(boxFade(centre, BOX, DUST.boxFade)).toBe(1)
    expect(boxFade({ ...centre, x: BOX.min.x }, BOX, DUST.boxFade)).toBe(0)
    expect(boxFade({ ...centre, y: BOX.min.y + BOX.size.y }, BOX, DUST.boxFade)).toBeCloseTo(0, 10)
  })
})

describe('dust in the beam', () => {
  it.each(PRESETS)('%s: bright on the ray from the glass centre, dark beside the beam', (_, preset) => {
    const d = beamDirectionInto(new Vector3(), preset.sunPosition)
    const aperture = apertureInto(createBeamWindow(), WINDOW, d, WINDOW_FRAME)
    const on = new Vector3(aperture.x, aperture.y, aperture.z).addScaledVector(d, 0.25)
    expect(isInBeam(on.x, on.y, on.z, aperture, d, ROOM_SURFACES, RAYS.reachEnd)).toBe(true)
    expect(dustBeamWeight(on, aperture, d, ROOM_SURFACES, SHAPE)).toBeCloseTo(1, 6)
    // Beside the beam: moved sideways and up past the lit opening.
    for (const beside of [
      on.clone().add(new Vector3(0, 0, aperture.halfWidth + 0.05)),
      on.clone().add(new Vector3(0, 0, -aperture.halfWidth - 0.05)),
      on.clone().add(new Vector3(0, aperture.halfHeight + 0.05, 0)),
    ]) {
      expect(isInBeam(beside.x, beside.y, beside.z, aperture, d, ROOM_SURFACES, RAYS.reachEnd)).toBe(false)
      expect(dustBeamWeight(beside, aperture, d, ROOM_SURFACES, SHAPE)).toBe(0)
    }
  })

  it.each(PRESETS)('%s: a share of the motes is in the beam, the rest is not', (_, preset) => {
    const d = beamDirectionInto(new Vector3(), preset.sunPosition)
    const aperture = apertureInto(createBeamWindow(), WINDOW, d, WINDOW_FRAME)
    const motes = createDustMotes(DUST)
    const p = new Vector3()
    let inside = 0
    let outside = 0
    for (let i = 0; i < DUST.count; i += 1) {
      const weight = dustBeamWeight(dustPositionInto(p, motes, i, 0, BOX, DUST.wobble), aperture, d, ROOM_SURFACES, SHAPE)
      if (weight > 0.5) inside += 1
      if (weight < 0.05) outside += 1
    }
    expect(inside).toBeGreaterThan(DUST.count * 0.1)
    expect(outside).toBeGreaterThan(DUST.count * 0.1)
  })
})
