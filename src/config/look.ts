// Every tweakable look value lives here (or in a file re-exported below). Components read from this module, never inline.
// Colors are sRGB hex. Palette keys are the contract material names (SPEC section 5).

export { TEAS, type Tea } from '../lib/teas.ts'
export { STEAM_LOOK_DEFAULTS, KETTLE_STEAM_LOOK, KETTLE_STEAM_DENSITY_FACTOR, KETTLE_STEAM_HEIGHT_FACTOR, type SteamLook } from '../nook/steamDefaults.ts'
export { STEAM_DEFAULTS, type SteamParams } from '../lib/steamMath.ts'

/** Material color by contract material name. SPEC section 3 for the six main ones; the rest are placeholders until the references arrive. */
export const PALETTE = {
  Mat_Wall: '#F2E6D0',
  Mat_Wood: '#C98F5B',
  Mat_Mug: '#D9694A',
  Mat_Kettle: '#8FB8A0',
  Mat_Leaf: '#6E9A5B',
  Mat_Frame: '#F7F3EA',
  // Placeholders, not from SPEC section 3.
  Mat_Pot: '#B5654A',
  Mat_Tin: '#C9B8A0',
  Mat_Book: '#7A8FB0',
  Mat_Tea: '#8A4B2A',
  Mat_KettleDetail: '#5E7F6C',
  Mat_Glass: '#CFE6F2',
  Mat_Sky: '#BFD8F0',
} as const

export type MaterialName = keyof typeof PALETTE

export type Vec3 = readonly [number, number, number]

export interface LightPreset {
  /** Directional sun. */
  sunColor: string
  sunIntensity: number
  sunPosition: Vec3
  /** Hemisphere fill: sky color above, ground color below. */
  fillSkyColor: string
  fillGroundColor: string
  fillIntensity: number
}

/** Light presets from SPEC section 3 (`morning` is applied in slice 1.4; `evening` is unused until 4.3). */
export const LIGHT_PRESETS = {
  morning: {
    sunColor: '#FFF1D6',
    sunIntensity: 2.4,
    sunPosition: [0.6, 1, 0.5],
    fillSkyColor: '#BFD8F0',
    fillGroundColor: '#F2E6D0',
    fillIntensity: 1.6,
  },
  evening: {
    sunColor: '#FF9A57',
    sunIntensity: 1.5,
    sunPosition: [0.8, 0.25, 0.3],
    fillSkyColor: '#3C4E7A',
    fillGroundColor: '#2A2A3C',
    fillIntensity: 0.5,
  },
} as const satisfies Record<string, LightPreset>

export type LightPresetName = keyof typeof LIGHT_PRESETS

/** Camera pose as spherical offsets from the `Orbit_Target` marker (angles in degrees, distance in meters). */
export interface CameraPose {
  /** Horizontal angle around the target: 0 is straight in front (+Z), positive is towards the right (+X). */
  azimuth: number
  /** Angle from straight up: 0 is looking down from above, 90 is level with the target. */
  polar: number
  distance: number
}

/**
 * Baked ambient occlusion of `Room` (slice 2.4, texture `public/models/room_ao.png` on the `UV_AO` layer).
 * `intensity` is three's `aoMapIntensity`: 0 = off, 1 = as baked. three applies it to the indirect (hemisphere)
 * light only, so the sun-lit parts darken less than the shaded ones; 1.6 makes the contact shadows readable. Keep it
 * at or below 1 / (1 - FLOOR) = 1.67 (FLOOR 0.40 in `tools/blender/steps/05_ao_bake.py`), above that three's
 * `1 + (ao - 1) * intensity` goes negative in the darkest corners and shows as dark or coloured fringes.
 */
export const AO = {
  intensity: 1.6,
} as const

/** Canvas and page background, behind the diorama. */
export const BACKGROUND_COLOR = '#E9DFCB'

export const CAMERA = {
  fov: 35,
  near: 0.01,
  far: 20,
  /**
   * Pose presets, relative to the `Orbit_Target` marker (never a hard-coded position). `hero` is the default view;
   * the others are for reproducible screenshots (`?cam=<name>` in dev). `side` and `top` lie outside `limits` on
   * purpose: they are dev-only views, and the dev hook lifts the orbit limits when a preset needs it.
   */
  presets: {
    hero: { azimuth: 25, polar: 68, distance: 2.6 },
    front: { azimuth: 0, polar: 75, distance: 2.6 },
    side: { azimuth: 90, polar: 75, distance: 2.6 },
    top: { azimuth: 0, polar: 5, distance: 2.6 },
  },
  /** Orbit limits, applied to the controls (panning is off). Angles in degrees. */
  limits: {
    azimuthMin: -35,
    azimuthMax: 35,
    polarMin: 55,
    polarMax: 80,
    distanceMin: 1.5,
    distanceMax: 3.4,
  },
} as const satisfies { presets: Record<string, CameraPose> } & Record<string, unknown>

export type CameraPresetName = keyof typeof CAMERA.presets
