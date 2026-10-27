/**
 * Tileable 2D Perlin noise, generated on the CPU once and uploaded as a small texture.
 * Replaces a shipped perlin.png: no asset to load, no binary in git, and it is testable.
 */

/** Deterministic PRNG (mulberry32), so the texture is identical on every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * One octave of Perlin noise on a lattice of `cells` x `cells` gradients that wraps, so the
 * result tiles seamlessly. `x` and `y` are in lattice units. Returns roughly [-1, 1].
 */
export function makeTileableNoise(cells: number, seed: number): (x: number, y: number) => number {
  const rand = mulberry32(seed)
  const gx = new Float32Array(cells * cells)
  const gy = new Float32Array(cells * cells)
  for (let i = 0; i < cells * cells; i++) {
    const angle = rand() * Math.PI * 2
    gx[i] = Math.cos(angle)
    gy[i] = Math.sin(angle)
  }
  const wrap = (n: number): number => ((n % cells) + cells) % cells
  const dot = (ix: number, iy: number, x: number, y: number): number => {
    const k = wrap(iy) * cells + wrap(ix)
    return (gx[k] ?? 0) * (x - ix) + (gy[k] ?? 0) * (y - iy)
  }
  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const u = fade(x - x0)
    const v = fade(y - y0)
    const top = dot(x0, y0, x, y) * (1 - u) + dot(x0 + 1, y0, x, y) * u
    const bottom = dot(x0, y0 + 1, x, y) * (1 - u) + dot(x0 + 1, y0 + 1, x, y) * u
    // Perlin's theoretical range for unit gradients is +-sqrt(2)/2, so scale to about +-1.
    return (top * (1 - v) + bottom * v) * Math.SQRT2
  }
}

export interface PerlinTextureOptions {
  /** Texture side in texels. */
  size: number
  /** Lattice cells per side of the first octave. */
  cells: number
  /** Number of octaves; each doubles the cells and halves the amplitude. */
  octaves: number
  seed: number
}

/**
 * RGBA bytes of a tileable noise texture. R and G hold two independent noise fields
 * (the shader uses one for the twist and one for the alpha mask), B repeats R, A is 255.
 */
export function generatePerlinTexture({ size, cells, octaves, seed }: PerlinTextureOptions): Uint8Array {
  const channels = [0, 1].map((channel) =>
    Array.from({ length: octaves }, (_, o) => makeTileableNoise(cells * 2 ** o, seed + channel * 1009 + o * 31)),
  )
  const data = new Uint8Array(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const values = channels.map((noises) => {
        let sum = 0
        let norm = 0
        noises.forEach((noise, o) => {
          const freq = cells * 2 ** o
          const amp = 0.5 ** o
          sum += noise((px / size) * freq, (py / size) * freq) * amp
          norm += amp
        })
        return Math.min(1, Math.max(0, (sum / norm) * 0.5 + 0.5))
      })
      const i = (py * size + px) * 4
      const r = Math.round((values[0] ?? 0) * 255)
      data[i] = r
      data[i + 1] = Math.round((values[1] ?? 0) * 255)
      data[i + 2] = r
      data[i + 3] = 255
    }
  }
  return data
}
