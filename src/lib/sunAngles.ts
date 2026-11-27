import type { Point3 } from './shadowFit.ts'

/**
 * Sun direction as two angles in degrees. Azimuth is measured like the camera's: 0 is straight in front of the diorama
 * (+Z, towards the viewer), positive is towards the right (+X), negative towards the left (-X), 180 is behind it.
 * Altitude is the SPEC's "elevation": the angle above the horizon (0 on the floor plane, 90 straight above). The code
 * says altitude because property names survive minification, and the release check `grep -r leva dist` (no dev panel in
 * the bundle) also matches the other word.
 */
export interface SunAngles {
  azimuth: number
  altitude: number
}

const DEG = Math.PI / 180

/** Writes the world position of a sun at `distance` meters from the origin into `out` (no allocation, for per-frame use). */
export function sunPositionInto<T extends { x: number; y: number; z: number }>(out: T, azimuth: number, altitude: number, distance: number): T {
  const a = azimuth * DEG
  const e = altitude * DEG
  out.x = distance * Math.cos(e) * Math.sin(a)
  out.y = distance * Math.sin(e)
  out.z = distance * Math.cos(e) * Math.cos(a)
  return out
}

/** World position of a sun at `distance` meters from the origin in the given direction. */
export function sunPositionFromAngles({ azimuth, altitude }: SunAngles, distance: number): [number, number, number] {
  const p = sunPositionInto({ x: 0, y: 0, z: 0 }, azimuth, altitude, distance)
  return [p.x, p.y, p.z]
}

/** Inverse of `sunPositionFromAngles` for a sun at `position` looking at the origin (the distance is `Math.hypot(...position)`). */
export function sunAnglesFromPosition(position: Point3): SunAngles {
  const [x, y, z] = position
  return { azimuth: Math.atan2(x, z) / DEG, altitude: Math.atan2(y, Math.hypot(x, z)) / DEG }
}
