// The sun beam through the window as pure maths: direction, lit opening, where a ray ends, whether a point is inside,
// and the falloff curves of the light rays. The ray shader has GLSL twins (`src/shaders/rays.common.glsl`); change
// both together. The dust motes use the same functions. Nothing here allocates, so it can run every frame.
//
// The window is a rectangle in a plane of constant x (the left wall); the beam travels towards +x.

export interface Vec3Like {
  x: number
  y: number
  z: number
}

/** A level rectangle at height `y`. */
export interface HorizontalSurface {
  readonly y: number
  readonly xMin: number
  readonly xMax: number
  readonly zMin: number
  readonly zMax: number
}

/** An upright rectangle facing +z, at depth `z`. */
export interface WallSurface {
  readonly z: number
  readonly xMin: number
  readonly xMax: number
  readonly yMin: number
  readonly yMax: number
}

/** What a sun ray can end on. */
export interface RoomSurfaces {
  readonly worktop: HorizontalSurface
  readonly backWall: WallSurface
  readonly floor: HorizontalSurface
}

export interface FrameShape {
  readonly width: number
  readonly halfDepth: number
  readonly mullionWidth: number
}

/** A rectangle in a plane of constant x: its centre, half its height (y) and half its width (z). */
export interface BeamWindow {
  x: number
  y: number
  z: number
  halfHeight: number
  halfWidth: number
}

export function createBeamWindow(): BeamWindow {
  return { x: 0, y: 0, z: 0, halfHeight: 0, halfWidth: 0 }
}

/** Same curve as GLSL `smoothstep`. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Writes the unit direction of the sunlight, from the sun position to the world origin, into `out`. */
export function beamDirectionInto<T extends Vec3Like>(out: T, sunPosition: Readonly<Vec3Like>): T {
  const { x, y, z } = sunPosition
  const length = Math.hypot(x, y, z) || 1
  out.x = -x / length
  out.y = -y / length
  out.z = -z / length
  return out
}

/**
 * How much of the beam there is for a sun direction: 0 while the sun is behind the window wall or grazes it
 * (`direction.x` at most `from`), 1 from `to` on.
 */
export function beamVisibility(direction: Readonly<Vec3Like>, from: number, to: number): number {
  return smoothstep(from, to, direction.x)
}

/**
 * Writes the lit part of the window at the glass plane into `out`: the opening minus the frame bars, minus what the
 * depth of the bars cuts off at this sun angle (a slanted ray has to clear both their faces).
 */
export function apertureInto(out: BeamWindow, window: Readonly<BeamWindow>, direction: Readonly<Vec3Like>, frame: FrameShape): BeamWindow {
  const x = Math.max(direction.x, 1e-3)
  out.x = window.x
  out.y = window.y
  out.z = window.z
  out.halfHeight = Math.max(0, window.halfHeight - frame.width - frame.halfDepth * Math.abs(direction.y / x))
  out.halfWidth = Math.max(0, window.halfWidth - frame.width - frame.halfDepth * Math.abs(direction.z / x))
  return out
}

/** Distance along the ray to a level surface, or `Infinity` if the ray misses it. */
export function horizontalHitDistance(ox: number, oy: number, oz: number, d: Readonly<Vec3Like>, s: HorizontalSurface): number {
  if (d.y === 0) return Infinity
  const t = (s.y - oy) / d.y
  if (!(t > 0)) return Infinity
  const x = ox + d.x * t
  const z = oz + d.z * t
  return x >= s.xMin && x <= s.xMax && z >= s.zMin && z <= s.zMax ? t : Infinity
}

/** Distance along the ray to an upright wall, or `Infinity` if the ray misses it. */
export function wallHitDistance(ox: number, oy: number, oz: number, d: Readonly<Vec3Like>, s: WallSurface): number {
  if (d.z === 0) return Infinity
  const t = (s.z - oz) / d.z
  if (!(t > 0)) return Infinity
  const x = ox + d.x * t
  const y = oy + d.y * t
  return x >= s.xMin && x <= s.xMax && y >= s.yMin && y <= s.yMax ? t : Infinity
}

/**
 * Length of the ray from (`ox`, `oy`, `oz`) along the unit direction `d`: it ends at the first of worktop top, back wall
 * or floor, and at `maxLength` if it reaches none of them before that.
 */
export function rayEndDistance(ox: number, oy: number, oz: number, d: Readonly<Vec3Like>, surfaces: RoomSurfaces, maxLength: number): number {
  return Math.min(
    maxLength,
    horizontalHitDistance(ox, oy, oz, d, surfaces.worktop),
    wallHitDistance(ox, oy, oz, d, surfaces.backWall),
    horizontalHitDistance(ox, oy, oz, d, surfaces.floor),
  )
}

/** Where a point lies in the beam: distance `t` from the window along the beam, and the window point it came through. */
export interface BeamCoordinates {
  t: number
  y: number
  z: number
}

/**
 * Follows the beam backwards from a point to the window plane and writes the result into `out`. Returns false for a
 * point the beam cannot reach (the sun is behind the window wall, or the point is behind the window).
 */
export function beamCoordinatesInto(out: BeamCoordinates, px: number, py: number, pz: number, aperture: Readonly<BeamWindow>, d: Readonly<Vec3Like>): boolean {
  if (!(d.x > 0)) return false
  const t = (px - aperture.x) / d.x
  if (t < 0) return false
  out.t = t
  out.y = py - d.y * t
  out.z = pz - d.z * t
  return true
}

const scratch: BeamCoordinates = { t: 0, y: 0, z: 0 }

/** True if the sun reaches the point: it came through the lit opening and no surface ended its ray before. */
export function isInBeam(px: number, py: number, pz: number, aperture: Readonly<BeamWindow>, d: Readonly<Vec3Like>, surfaces: RoomSurfaces, maxLength: number): boolean {
  if (!beamCoordinatesInto(scratch, px, py, pz, aperture, d)) return false
  if (Math.abs(scratch.y - aperture.y) > aperture.halfHeight || Math.abs(scratch.z - aperture.z) > aperture.halfWidth) return false
  return scratch.t <= rayEndDistance(aperture.x, scratch.y, scratch.z, d, surfaces, maxLength) + 1e-9
}

// ------------------------------------------------------------------ falloff curves (GLSL twins) ----

/** Soft top and bottom of the beam: 0 at `v` 0 and 1, full from `softness` inwards. */
export function crossProfile(v: number, softness: number): number {
  return smoothstep(0, softness, v) * smoothstep(0, softness, 1 - v)
}

/** Shadow of a cross bar: `offset` is the distance from its centre line, `dim` the share of light it takes away. */
export function mullionFade(offset: number, halfWidth: number, softness: number, dim: number): number {
  return 1 - dim * (1 - smoothstep(halfWidth, halfWidth + softness, Math.abs(offset)))
}

/** Fade along the beam: in over `fadeIn` meters from the window, out between `reachStart` and `reachEnd`. */
export function lengthFade(t: number, fadeIn: number, reachStart: number, reachEnd: number): number {
  return smoothstep(0, fadeIn, t) * (1 - smoothstep(reachStart, reachEnd, t))
}

/** 1 inside `min`..`max`, falling to 0 over `margin` outside. */
export function softInside(value: number, min: number, max: number, margin: number): number {
  return smoothstep(min - margin, min, value) * (1 - smoothstep(max, max + margin, value))
}

/** Fade of one surface: `hit` is the distance to its plane, `inside` how much the hit point belongs to its rectangle. */
export function surfaceFade(t: number, hit: number, inside: number, fadeOut: number): number {
  if (!(hit > 0)) return 1
  return 1 - inside * (1 - smoothstep(0, fadeOut, hit - t))
}

function horizontalFade(ox: number, oy: number, oz: number, d: Readonly<Vec3Like>, t: number, s: HorizontalSurface, fadeOut: number, margin: number): number {
  if (d.y === 0) return 1
  const hit = (s.y - oy) / d.y
  const inside = softInside(ox + d.x * hit, s.xMin, s.xMax, margin) * softInside(oz + d.z * hit, s.zMin, s.zMax, margin)
  return surfaceFade(t, hit, inside, fadeOut)
}

function wallFade(ox: number, oy: number, oz: number, d: Readonly<Vec3Like>, t: number, s: WallSurface, fadeOut: number, margin: number): number {
  if (d.z === 0) return 1
  const hit = (s.z - oz) / d.z
  const inside = softInside(ox + d.x * hit, s.xMin, s.xMax, margin) * softInside(oy + d.y * hit, s.yMin, s.yMax, margin)
  return surfaceFade(t, hit, inside, fadeOut)
}

/**
 * The soft version of `rayEndDistance` for drawing: 1 well before the ray ends, 0 from the surface on, reached over
 * `fadeOut` meters. Each rectangle has a soft border of `margin` meters, so two neighbouring rays, one of which just
 * misses a surface edge, do not differ by a hard step.
 */
export function endFade(ox: number, oy: number, oz: number, d: Readonly<Vec3Like>, t: number, surfaces: RoomSurfaces, fadeOut: number, margin: number): number {
  return (
    horizontalFade(ox, oy, oz, d, t, surfaces.worktop, fadeOut, margin) *
    wallFade(ox, oy, oz, d, t, surfaces.backWall, fadeOut, margin) *
    horizontalFade(ox, oy, oz, d, t, surfaces.floor, fadeOut, margin)
  )
}
