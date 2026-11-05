import { describe, expect, it } from 'vitest'
import { boxCorners, fitShadowFrustum, type Point3 } from './shadowFit.ts'
import { sunAnglesFromPosition, sunPositionFromAngles } from './sunAngles.ts'

/** Small deterministic generator (mulberry32) so the "random" directions are the same on every run. */
function rng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BOX = boxCorners([-0.55, -0.1, -0.5], [0.6, 0.9, 0.55])

describe('fitShadowFrustum', () => {
  it('matches the box for a light straight along an axis', () => {
    // Sun on the +Z axis looking at the origin: the light's right is +X and its up is +Y.
    const f = fitShadowFrustum([0, 0, 3], BOX, 0)
    expect(f.left).toBeCloseTo(-0.55)
    expect(f.right).toBeCloseTo(0.6)
    expect(f.bottom).toBeCloseTo(-0.1)
    expect(f.top).toBeCloseTo(0.9)
    expect(f.near).toBeCloseTo(3 - 0.55)
    expect(f.far).toBeCloseTo(3 + 0.5)
  })

  it('grows every side by the margin', () => {
    const tight = fitShadowFrustum([0, 0, 3], BOX, 0)
    const loose = fitShadowFrustum([0, 0, 3], BOX, 0.02)
    expect(loose.left).toBeCloseTo(tight.left - 0.02)
    expect(loose.right).toBeCloseTo(tight.right + 0.02)
    expect(loose.bottom).toBeCloseTo(tight.bottom - 0.02)
    expect(loose.top).toBeCloseTo(tight.top + 0.02)
    expect(loose.near).toBeCloseTo(tight.near - 0.02)
    expect(loose.far).toBeCloseTo(tight.far + 0.02)
  })

  it('keeps near positive when the light is inside the box range', () => {
    expect(fitShadowFrustum([0, 0.5, 0.1], BOX, 0.01).near).toBeGreaterThan(0)
  })

  it('contains all 8 corners for random sun directions, and the volume is tight', () => {
    const next = rng(42)
    for (let i = 0; i < 200; i += 1) {
      const position = sunPositionFromAngles({ azimuth: -180 + next() * 360, elevation: 5 + next() * 80 }, 1.5 + next() * 2)
      const margin = 0.01
      const f = fitShadowFrustum(position, BOX, margin)
      // Re-project independently with three's lookAt convention and check every corner is inside.
      const len = Math.hypot(...position)
      const forward: Point3 = [-position[0] / len, -position[1] / len, -position[2] / len]
      const rx = forward[1] * 0 - forward[2] * 1
      const rz = forward[0] * 1 - forward[1] * 0
      const rl = Math.hypot(rx, rz)
      const right: Point3 = [rx / rl, 0, rz / rl]
      const up: Point3 = [
        right[1] * forward[2] - right[2] * forward[1],
        right[2] * forward[0] - right[0] * forward[2],
        right[0] * forward[1] - right[1] * forward[0],
      ]
      for (const c of BOX) {
        const d: Point3 = [c[0] - position[0], c[1] - position[1], c[2] - position[2]]
        const x = d[0] * right[0] + d[1] * right[1] + d[2] * right[2]
        const y = d[0] * up[0] + d[1] * up[1] + d[2] * up[2]
        const z = d[0] * forward[0] + d[1] * forward[1] + d[2] * forward[2]
        expect(x).toBeGreaterThanOrEqual(f.left)
        expect(x).toBeLessThanOrEqual(f.right)
        expect(y).toBeGreaterThanOrEqual(f.bottom)
        expect(y).toBeLessThanOrEqual(f.top)
        expect(z).toBeGreaterThanOrEqual(f.near)
        expect(z).toBeLessThanOrEqual(f.far)
      }
      // Tight: at most the margin of slack on each side of the extreme corner.
      expect(f.right - f.left).toBeLessThan(Math.hypot(1.15, 1, 1.05) + 2 * margin + 1e-9)
    }
  })
})

describe('sun angles', () => {
  it('points the sun to the front-left for negative azimuth and positive z', () => {
    const [x, y, z] = sunPositionFromAngles({ azimuth: -60, elevation: 40 }, 1)
    expect(x).toBeLessThan(0)
    expect(y).toBeGreaterThan(0)
    expect(z).toBeGreaterThan(0)
  })

  it('keeps the distance and round-trips through the angles', () => {
    const next = rng(7)
    for (let i = 0; i < 50; i += 1) {
      const angles = { azimuth: -179 + next() * 358, elevation: next() * 89 }
      const distance = 0.5 + next() * 3
      const position = sunPositionFromAngles(angles, distance)
      expect(Math.hypot(...position)).toBeCloseTo(distance)
      const back = sunAnglesFromPosition(position)
      expect(back.azimuth).toBeCloseTo(angles.azimuth)
      expect(back.elevation).toBeCloseTo(angles.elevation)
    }
  })
})
