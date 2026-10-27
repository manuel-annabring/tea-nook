/**
 * CPU twin of the steam maths. The Leva defaults, the unit tests and the GLSL in
 * src/shaders/steam.* use the same formulas, so a change here must be mirrored there.
 * `h` is the normalized height along the steam: 0 at the mug opening, 1 at the top.
 * Lengths (pointer radius, strength) are meters.
 */

export interface SteamParams {
  /** Twist angle at h = 1, radians. */
  twistMax: number
  /** Shape of the twist curve: 1 is linear, above 1 keeps the base calm. */
  twistPower: number
  /** Alpha reaches 1 at this height. */
  fadeIn: number
  /** Alpha starts falling to 0 at this height. */
  fadeOut: number
  /** Pointer influence radius, meters. */
  pointerRadius: number
  /** Maximum push distance at the pointer, meters. */
  pointerStrength: number
  /** Sharpness of the pointer falloff. */
  pointerPower: number
  /** Height below which the pointer cannot push (keeps the base on the mug). */
  pointerAnchor: number
}

/** Picked in the slice 1 widget, then tuned in the Leva panel on the billboard steam (2026-10-27). */
export const STEAM_DEFAULTS: SteamParams = {
  twistMax: 6.4,
  twistPower: 2.15,
  fadeIn: 0.13,
  fadeOut: 0.51,
  pointerRadius: 0.07,
  pointerStrength: 0.04,
  pointerPower: 1.5,
  pointerAnchor: 0.4,
}

/** GLSL `smoothstep`: 0 below `edge0`, 1 above `edge1`, smooth in between. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Swirl angle at height `h`. */
export function twistAngle(h: number, twistMax: number, twistPower: number): number {
  return twistMax * Math.pow(Math.min(1, Math.max(0, h)), twistPower)
}

/** Alpha multiplier at height `h`: fades in near the base and out near the top. */
export function heightFade(h: number, fadeIn: number, fadeOut: number): number {
  return smoothstep(0, fadeIn, h) * (1 - smoothstep(fadeOut, 1, h))
}

/** 1 at the pointer, 0 at `radius` and beyond. */
export function pointerFalloff(distance: number, radius: number, power: number): number {
  return Math.pow(1 - smoothstep(0, radius, distance), power)
}

/** How far a point at height `h`, `distance` meters from the pointer, is pushed away. */
export function pointerPush(distance: number, h: number, p: SteamParams): number {
  return p.pointerStrength * pointerFalloff(distance, p.pointerRadius, p.pointerPower) * smoothstep(0, p.pointerAnchor, h)
}
