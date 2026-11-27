// The dust motes as pure maths: the box they float in, their fixed per-mote values, where a mote is at a given time and
// how much of the window beam reaches it. `src/shaders/dust.vert.glsl` has the GLSL twins of `dustPositionInto`,
// `boxFade` and `dustBeamWeight`; change both together. The beam itself is `beam.ts`, as for the light rays.

import {
  beamCoordinatesInto,
  endFade,
  lengthFade,
  smoothstep,
  softInside,
  type BeamCoordinates,
  type BeamWindow,
  type RoomSurfaces,
  type Vec3Like,
} from './beam.ts'

/** An axis-aligned box: its lowest corner and its size (all sizes positive). */
export interface DustBox {
  min: Vec3Like
  size: Vec3Like
}

/** The box between two opposite corners, given in any order per axis. */
export function dustBoxFrom(a: Readonly<Vec3Like>, b: Readonly<Vec3Like>): DustBox {
  return {
    min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) },
    size: { x: Math.abs(a.x - b.x), y: Math.abs(a.y - b.y), z: Math.abs(a.z - b.z) },
  }
}

export interface DustMotion {
  readonly count: number
  readonly seed: number
  /** Share by which sizes differ from the mean, either way. */
  readonly sizeSpread: number
  /** Brightness of the faintest mote (the brightest is 1). */
  readonly minBrightness: number
  /** Mean velocity and its random part (either way, per axis), meters per second. */
  readonly drift: readonly [number, number, number]
  readonly driftSpread: number
  /** Slowest and fastest wobble, cycles per second. */
  readonly wobbleRate: readonly [number, number]
}

/** The fixed values of all motes, laid out as the geometry attributes. */
export interface DustMotes {
  /** Start position as shares of the box, 3 per mote. */
  base: Float32Array
  /** Meters per second, 3 per mote. */
  velocity: Float32Array
  /** Wobble phase per axis (cycles) and wobble rate (cycles per second), 4 per mote. */
  wobble: Float32Array
  /** Size factor and brightness, 2 per mote. */
  look: Float32Array
}

/** Small seeded random generator (mulberry32), values in [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createDustMotes(motion: DustMotion): DustMotes {
  const { count } = motion
  const random = seededRandom(motion.seed)
  const either = () => random() * 2 - 1
  const motes: DustMotes = {
    base: new Float32Array(count * 3),
    velocity: new Float32Array(count * 3),
    wobble: new Float32Array(count * 4),
    look: new Float32Array(count * 2),
  }
  const [slow, fast] = motion.wobbleRate
  for (let i = 0; i < count; i += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      motes.base[i * 3 + axis] = random()
      motes.velocity[i * 3 + axis] = (motion.drift[axis] ?? 0) + either() * motion.driftSpread
      motes.wobble[i * 4 + axis] = random()
    }
    motes.wobble[i * 4 + 3] = slow + random() * (fast - slow)
    motes.look[i * 2] = 1 + either() * motion.sizeSpread
    motes.look[i * 2 + 1] = motion.minBrightness + random() * (1 - motion.minBrightness)
  }
  return motes
}

const fract = (v: number) => v - Math.floor(v)
const at = (values: Float32Array, index: number) => values[index] ?? 0
const TAU = Math.PI * 2

/**
 * Writes the position of mote `index` at `time` into `out`: it drifts and wobbles, and wraps around inside the box, so
 * it can never leave it. `wobble` is the amplitude in meters.
 */
export function dustPositionInto<T extends Vec3Like>(out: T, motes: DustMotes, index: number, time: number, box: DustBox, wobble: number): T {
  const i = index * 3
  const w = index * 4
  const rate = at(motes.wobble, w + 3)
  const share = (axis: number, size: number) =>
    fract(at(motes.base, i + axis) + (at(motes.velocity, i + axis) * time + wobble * Math.sin(TAU * (at(motes.wobble, w + axis) + rate * time))) / size)
  out.x = box.min.x + share(0, box.size.x) * box.size.x
  out.y = box.min.y + share(1, box.size.y) * box.size.y
  out.z = box.min.z + share(2, box.size.z) * box.size.z
  return out
}

/**
 * Fade towards the faces of the box (0 on a face, 1 from `margin` inwards, `margin` as a share of the box), so a mote
 * that wraps around to the other side does so unseen.
 */
export function boxFade(p: Readonly<Vec3Like>, box: DustBox, margin: number): number {
  const axis = (value: number, min: number, size: number) => {
    const u = (value - min) / size
    return smoothstep(0, margin, u) * smoothstep(0, margin, 1 - u)
  }
  return axis(p.x, box.min.x, box.size.x) * axis(p.y, box.min.y, box.size.y) * axis(p.z, box.min.z, box.size.z)
}

export interface DustBeamShape {
  /** Width of the soft sides of the beam, meters, centred on the edge of the lit opening. */
  readonly softness: number
  /** As in `RAYS`: the same fades along the beam and towards the surfaces. */
  readonly fadeIn: number
  readonly reachStart: number
  readonly reachEnd: number
  readonly endFade: number
  readonly edgeMargin: number
}

const coordinates: BeamCoordinates = { t: 0, y: 0, z: 0 }
const origin: Vec3Like = { x: 0, y: 0, z: 0 }

/**
 * The soft version of `isInBeam` for drawing: 1 well inside the sun beam, 0 beside it, behind the surface that ends the
 * ray and beyond the reach of the rays. Allocates nothing.
 */
export function dustBeamWeight(
  p: Readonly<Vec3Like>,
  aperture: Readonly<BeamWindow>,
  d: Readonly<Vec3Like>,
  surfaces: RoomSurfaces,
  shape: DustBeamShape,
): number {
  if (!beamCoordinatesInto(coordinates, p.x, p.y, p.z, aperture, d)) return 0
  const { t, y, z } = coordinates
  const half = shape.softness / 2
  const across =
    softInside(y, aperture.y - aperture.halfHeight + half, aperture.y + aperture.halfHeight - half, shape.softness) *
    softInside(z, aperture.z - aperture.halfWidth + half, aperture.z + aperture.halfWidth - half, shape.softness)
  origin.x = aperture.x
  origin.y = y
  origin.z = z
  return (
    across *
    lengthFade(t, shape.fadeIn, shape.reachStart, shape.reachEnd) *
    endFade(origin.x, origin.y, origin.z, d, t, surfaces, shape.endFade, shape.edgeMargin)
  )
}
