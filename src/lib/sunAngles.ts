import type { Point3 } from './shadowFit.ts'

/**
 * Sun direction as two angles in degrees. Azimuth is measured like the camera's: 0 is straight in front of the diorama
 * (+Z, towards the viewer), positive is towards the right (+X), negative towards the left (-X), 180 is behind it.
 * Elevation is the angle above the horizon (0 on the floor plane, 90 straight above).
 */
export interface SunAngles {
  azimuth: number
  elevation: number
}

const DEG = Math.PI / 180

/** World position of a sun at `distance` meters from the origin in the given direction. */
export function sunPositionFromAngles({ azimuth, elevation }: SunAngles, distance: number): [number, number, number] {
  const a = azimuth * DEG
  const e = elevation * DEG
  return [distance * Math.cos(e) * Math.sin(a), distance * Math.sin(e), distance * Math.cos(e) * Math.cos(a)]
}

/** Inverse of `sunPositionFromAngles` for a sun at `position` looking at the origin (the distance is `Math.hypot(...position)`). */
export function sunAnglesFromPosition(position: Point3): SunAngles {
  const [x, y, z] = position
  return { azimuth: Math.atan2(x, z) / DEG, elevation: Math.atan2(y, Math.hypot(x, z)) / DEG }
}
