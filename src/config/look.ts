// Every tweakable look value lives here (or in a file re-exported below). Components read from this module, never inline.
// Colors are sRGB hex. Palette keys are the contract material names (SPEC section 5).

export { TEAS, type Tea } from '../lib/teas.ts'
export { STEAM_LOOK_DEFAULTS, type SteamLook } from '../nook/steamDefaults.ts'
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

/** Light presets from SPEC section 3. Intensities and positions are placeholders until slice 1.4. `evening` is unused until 4.3. */
export const LIGHT_PRESETS = {
  morning: {
    sunColor: '#FFF1D6',
    sunIntensity: 2,
    sunPosition: [0.6, 1, 0.5],
    fillSkyColor: '#BFD8F0',
    fillGroundColor: '#F2E6D0',
    fillIntensity: 0.7,
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

export interface CameraPose {
  position: Vec3
  target: Vec3
}

/** Orbit target height of the placeholder mug scene; replaced by `Orbit_Target` in slice 1.4. */
const TARGET: Vec3 = [0, 0.173, 0]

export const CAMERA = {
  fov: 35,
  near: 0.01,
  far: 20,
  /** Pose presets. `hero` is the default view; the others are for reproducible screenshots (`?cam=<name>` in dev). */
  presets: {
    hero: { position: [0.4, 0.28, 0.6], target: TARGET },
    front: { position: [0, 0.2, 0.9], target: TARGET },
    side: { position: [0.9, 0.2, 0], target: TARGET },
    top: { position: [0, 1, 0.001], target: TARGET },
  },
  /** Placeholders: not applied to the controls yet (slice 1.4 sets and applies them). Angles in degrees. */
  limits: {
    azimuthMin: -35,
    azimuthMax: 35,
    polarMin: 55,
    polarMax: 80,
    distanceMin: 0.5,
    distanceMax: 1.5,
  },
} as const satisfies { presets: Record<string, CameraPose> } & Record<string, unknown>

export type CameraPresetName = keyof typeof CAMERA.presets
