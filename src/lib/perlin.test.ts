import { describe, expect, it } from 'vitest'
import { generatePerlinTexture, makeTileableNoise } from './perlin.ts'

describe('makeTileableNoise', () => {
  it('repeats with the lattice period', () => {
    const noise = makeTileableNoise(4, 1)
    expect(noise(0.37, 1.91)).toBeCloseTo(noise(4.37, 1.91))
    expect(noise(0.37, 1.91)).toBeCloseTo(noise(0.37, 5.91))
  })

  it('is deterministic for a seed and differs between seeds', () => {
    expect(makeTileableNoise(4, 1)(1.5, 2.5)).toBe(makeTileableNoise(4, 1)(1.5, 2.5))
    expect(makeTileableNoise(4, 1)(1.5, 2.5)).not.toBe(makeTileableNoise(4, 2)(1.5, 2.5))
  })

  it('is zero on lattice points', () => {
    expect(makeTileableNoise(4, 1)(2, 3)).toBeCloseTo(0)
  })
})

describe('generatePerlinTexture', () => {
  const opts = { size: 32, cells: 4, octaves: 2, seed: 7 }
  const data = generatePerlinTexture(opts)

  it('returns size * size RGBA bytes', () => {
    expect(data.length).toBe(32 * 32 * 4)
  })

  it('has opaque alpha and independent R and G channels', () => {
    let different = 0
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 3]).toBe(255)
      if (data[i] !== data[i + 1]) different++
    }
    expect(different).toBeGreaterThan(32 * 32 * 0.5)
  })

  it('uses a wide range of values', () => {
    const reds = Array.from({ length: 32 * 32 }, (_, i) => data[i * 4] ?? 0)
    expect(Math.max(...reds) - Math.min(...reds)).toBeGreaterThan(100)
  })

  it('is deterministic', () => {
    expect(generatePerlinTexture(opts)).toEqual(data)
  })
})
