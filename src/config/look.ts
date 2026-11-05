// Every tweakable look value lives here (or in a file re-exported below). Components read from this module, never inline.
// Colors are sRGB hex. Palette keys are the contract material names (SPEC section 5).

export { TEAS, type Tea } from '../lib/teas.ts'
export { STEAM_LOOK_DEFAULTS, KETTLE_STEAM_LOOK, KETTLE_STEAM_DENSITY_FACTOR, KETTLE_STEAM_HEIGHT_FACTOR, type SteamLook, type SteamNoise } from '../nook/steamDefaults.ts'
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
  /**
   * Weak directional light from the camera side, without a shadow: it lifts the faces of the props that point towards
   * the viewer (the sun comes from the window on the left and grazes them). Intensity 0 turns it off.
   */
  frontFillColor: string
  frontFillIntensity: number
  frontFillPosition: Vec3
}

/** Light presets from SPEC section 3 (`morning` is applied in slice 1.4; `evening` is unused until 4.3). */
export const LIGHT_PRESETS = {
  morning: {
    sunColor: '#FFF1D6',
    sunIntensity: 4.8,
    // Azimuth -91 degrees, elevation about 42 (D-072): from the left, along the window wall's normal. At -58 (F5) the
    // light looked as if it came through the front wall. Before F5 z was -0.45 (behind the diorama).
    sunPosition: [-1.123, 1.0, -0.02],
    fillSkyColor: '#BFD8F0',
    fillGroundColor: '#F2E6D0',
    fillIntensity: 3.6,
    frontFillColor: '#FFF4E0',
    frontFillIntensity: 1.8,
    frontFillPosition: [-0.6, 0.8, 1.2],
  },
  evening: {
    sunColor: '#FF9A57',
    sunIntensity: 1.5,
    sunPosition: [0.8, 0.25, 0.3],
    fillSkyColor: '#3C4E7A',
    fillGroundColor: '#2A2A3C',
    fillIntensity: 0.5,
    // Off for now: phase 4 designs the evening lighting (a lamp is planned there), so the front fill stays out of it.
    frontFillColor: '#FFF4E0',
    frontFillIntensity: 0,
    frontFillPosition: [-0.6, 0.8, 1.2],
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
 * light only (the live sun shadow covers the sun, D-051); 1.3 keeps the contact shading without smudged panels. Keep it
 * at or below 1 / (1 - FLOOR) = 1.67 (FLOOR 0.40 in `tools/blender/steps/05_ao_bake.py`), above that three's
 * `1 + (ao - 1) * intensity` goes negative in the darkest corners and shows as dark or coloured fringes.
 */
export const AO = {
  intensity: 1.3,
} as const

/**
 * The one live shadow of the sun (slice 2.5, decision in DECISIONS.md and SPEC section 10). `mode`: `off` = baked AO
 * only, `live` = shadow map rendered every frame, `static` = rendered once (nothing that casts moves). In dev
 * `?shadow=off|live|static` overrides it for measuring. The shadow camera is orthographic, sits at the sun position
 * and looks at the world origin. Its volume is not stored here: `fitShadowFrustum` (`src/lib/shadowFit.ts`) computes
 * it from the bounding box of the casters and receivers (`Room`, `Mug`, `Kettle`) whenever the sun position changes,
 * so the sun direction can move (dev panel, evening preset) without refitting by hand. `margin` (meters) is added on
 * every side of the fitted volume for the PCF blur and the normal bias. With a 1024 map the texel size is the volume
 * width divided by 1024, about 1.2 to 1.6 mm for the morning sun.
 */
export const SHADOW = {
  mode: 'live',
  mapSize: 1024,
  /** Softness of the PCF edge, in shadow-map texels. */
  radius: 3,
  bias: -0.0004,
  normalBias: 0.003,
  margin: 0.01,
} as const

/**
 * Output tone mapping. `aces` is r3f's default (filmic: it greys and darkens the flat palette colours). `neutral` is
 * three's Khronos PBR Neutral: colours below about 0.8 stay as authored and only the bright sun patch is compressed,
 * which suits flat stylized materials. `exposure` scales the light before mapping.
 */
export const TONE = {
  mapping: 'neutral' as 'neutral' | 'aces' | 'none',
  exposure: 1,
}

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
  /**
   * Orbit limits, applied to the controls (panning is off). Angles in degrees. Slice 2.5: the azimuth starts at 0
   * (straight on) because from the left of that the window wall stands in front of the cabinet, mug and kettle (it is
   * the cut-away corner's outside). The distance minimum keeps the kettle steam column inside a 1280 x 720 view in
   * the steepest pose; the maximum keeps the diorama from shrinking to a postage stamp.
   */
  limits: {
    azimuthMin: 0,
    azimuthMax: 40,
    polarMin: 55,
    polarMax: 80,
    distanceMin: 1.8,
    distanceMax: 3.2,
  },
} as const satisfies { presets: Record<string, CameraPose> } & Record<string, unknown>

export type CameraPresetName = keyof typeof CAMERA.presets
