// Every tweakable look value lives here (or in a file re-exported below). Components read from this module, never inline.
// Colors are sRGB hex. Palette keys are the contract material names (SPEC section 5).

import { sunPositionFromAngles } from '../lib/sunAngles.ts'
import { TEAS } from '../lib/teas.ts'

export { TEAS, type Tea } from '../lib/teas.ts'
export { STEAM_LOOK_DEFAULTS, KETTLE_STEAM_LOOK, KETTLE_STEAM_DENSITY_FACTOR, KETTLE_STEAM_HEIGHT_FACTOR, type SteamLook, type SteamNoise } from '../nook/steamDefaults.ts'
export { STEAM_DEFAULTS, type SteamParams } from '../lib/steamMath.ts'

/** Liquid colour of tea `index`: the tea bags and the jar contents (`Mat_Bag0..3`) use the same colour language as the tea in the mug. */
function teaColor(index: number): string {
  const tea = TEAS[index]
  if (!tea) throw new Error(`TEAS has no entry ${index}`)
  return tea.liquidColor
}

/** Material color by contract material name. SPEC section 3 for the six main ones; the rest are placeholders until the references arrive. */
export const PALETTE = {
  Mat_Wall: '#937E6C', // review of phase 2b: darker taupe wall so the cream steam reads (D-116); Blender keeps #F2E6D0
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
  Mat_KettleDetail: '#3D3A38', // slice D4: warm graphite for the kettle handle, base plate, lid ring and knob (D-107)
  Mat_Glass: '#CFE6F2',
  Mat_Sky: '#BFD8F0',
  // Phase 2b (SPEC section 5 amendment of 2026-11-06): dark graphite for the shelf brackets, rail and hooks ...
  Mat_Iron: '#3A3A3A',
  // ... and one colour per tea (jar contents and, from slice D3, the tea bags), derived from TEAS so the two never drift.
  Mat_Bag0: teaColor(0),
  Mat_Bag1: teaColor(1),
  Mat_Bag2: teaColor(2),
  Mat_Bag3: teaColor(3),
  // Phase 4 (SPEC section 5 amendment of 2026-11-27): the pendant lamp shade, a warm parchment. Its glow is added at runtime
  // (`lampGlow` of the light presets below).
  Mat_Lamp: '#E8C48A',
} as const

export type MaterialName = keyof typeof PALETTE

export type Vec3 = readonly [number, number, number]

/** Canvas and page background, behind the diorama, in the morning (the evening one is in `LIGHT_PRESETS`). */
export const BACKGROUND_COLOR = '#E9DFCB'

/**
 * HTML overlay look (system font stack, no web fonts) in the morning. The values live in `src/index.css` as CSS variables;
 * this object (and `LIGHT_PRESETS.evening` for the evening) is the reference that `src/ui/ui.test.ts` compares them with.
 * Text colour is a dark warm brown; the hint, tea name and time toggle sit on a translucent cream pill because the floor
 * edge behind them is dark. `src/ui/ui.test.ts` checks the contrast.
 */
export const UI = {
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  text: '#3A2D22',
  pill: 'rgba(233, 223, 203, 0.86)',
}

/** Everything that depends on the time of day. `src/lib/timeOfDay.ts` blends two of these. */
export interface LightPreset {
  /** Directional sun. */
  sunColor: string
  sunIntensity: number
  /** World position; only its direction matters for the light, the distance places the shadow camera. */
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
  /** The pendant lamp: one point light without a shadow at the `Lamp_Light` marker (intensity in candela, 0 = off). */
  lampColor: string
  lampIntensity: number
  /** Self-light of the lamp shade (`Mat_Lamp` emissive colour and intensity): the point light cannot light its outside. */
  lampGlowColor: string
  lampGlow: number
  /** The "outside" card behind the window (`Mat_Sky`): its colour, and how much it shines by itself (0 = only lit). */
  skyColor: string
  skyGlow: number
  /**
   * Self-light of the four tea colours (`Mat_Bag0..3`: tea bags and jar contents), a share of their own colour. Keeps
   * the packets apart in dim warm light, where green and chamomile would otherwise look alike. 0 = off.
   */
  bagGlow: number
  /** Multiplies the steam colour (of the selected tea, and of the kettle) and its opacity. White and 1 = unchanged. */
  steamTint: string
  steamOpacity: number
  /**
   * Opacity of the window light rays where all their planes overlap (added light in the sun colour, `RAYS` below holds
   * the shape). 0 = off.
   */
  rayStrength: number
  /** Page and canvas background behind the diorama. */
  pageBackground: string
  /** Overlay text and the translucent pill behind it (CSS only, mirrored in `src/index.css`). */
  uiText: string
  uiPill: string
}

const MORNING_SUN_POSITION: Vec3 = [
  // Azimuth -91 degrees, elevation about 42 (D-072): from the left, along the window wall's normal. At -58 (F5) the
  // light looked as if it came through the front wall. Before F5 z was -0.45 (behind the diorama).
  -1.123, 1.0, -0.02,
]

/**
 * Evening sun (slice 4.0, D-141): azimuth -75, elevation 22 degrees (`altitude`, see `SunAngles`): through the window,
 * low and a little from the front; same distance as the morning sun.
 */
export const EVENING_SUN_ANGLES = { azimuth: -75, altitude: 22 } as const

/**
 * The two time-of-day presets (SPEC section 3). The app starts in `morning`; the toggle blends towards the other one.
 * In dev the Leva `Light` folder edits the active preset (not persisted: copy good values here).
 */
export const LIGHT_PRESETS = {
  morning: {
    sunColor: '#FFF1D6',
    sunIntensity: 4.8,
    sunPosition: MORNING_SUN_POSITION,
    fillSkyColor: '#BFD8F0',
    fillGroundColor: '#F2E6D0',
    fillIntensity: 3.6,
    frontFillColor: '#FFF4E0',
    frontFillIntensity: 1.8,
    frontFillPosition: [-0.6, 0.8, 1.2],
    // The lamp is off by day. It stays in the scene (a light added later would recompile every shader).
    lampColor: '#FFB35C',
    lampIntensity: 0,
    lampGlowColor: '#FFB35C',
    lampGlow: 0,
    skyColor: PALETTE.Mat_Sky,
    skyGlow: 0,
    bagGlow: 0,
    steamTint: '#FFFFFF',
    steamOpacity: 1,
    rayStrength: 0.4,
    pageBackground: BACKGROUND_COLOR,
    uiText: UI.text,
    uiPill: UI.pill,
  },
  // Colours of slice 4.0 (D-141, D-142, D-144); intensities, ground, front fill, glows and tint tuned against the render in
  // slice 4.2: amber sun and lamp, deep blue shadows from the sky half of the fill, the camera sides lifted enough to
  // keep the kettle, the mug and the four tea colours readable.
  evening: {
    sunColor: '#FF9A57',
    sunIntensity: 4,
    sunPosition: sunPositionFromAngles(EVENING_SUN_ANGLES, Math.hypot(...MORNING_SUN_POSITION)),
    fillSkyColor: '#3C4E7A',
    fillGroundColor: '#4A3644',
    fillIntensity: 3.4,
    frontFillColor: '#FFE4D2',
    frontFillIntensity: 1.2,
    frontFillPosition: [-0.6, 0.8, 1.2],
    lampColor: '#FFB35C',
    lampIntensity: 0.24,
    lampGlowColor: '#FFB35C',
    lampGlow: 0.55,
    skyColor: '#E8946A',
    skyGlow: 1,
    bagGlow: 0.45,
    steamTint: '#FFD3AC',
    steamOpacity: 1,
    rayStrength: 0.38,
    pageBackground: '#3A3350',
    uiText: '#F2E6D0',
    uiPill: 'rgba(58, 51, 80, 0.86)',
  },
} as const satisfies Record<string, LightPreset>

export type LightPresetName = keyof typeof LIGHT_PRESETS

/**
 * How the time of day changes. One blend factor (0 = morning, 1 = evening) is damped towards the selected preset with
 * `MathUtils.damp` (`damping` 4: 98 % after 1 s, snapped to the target at about 1.7 s). `maxDelta` caps the time step so
 * a long frame cannot make the look jump, `snap` is the remaining distance at which the blend is set to the target.
 * The overlay text does not follow the blend linearly: dark text on a darkening page would be unreadable for a long
 * moment, so it switches along a steeper curve, a smoothstep of width `textSwitchWidth` around `textSwitchCentre` (the
 * blend where the morning and the evening text colour read equally well on the blended page). `cssSteps` is the
 * resolution of the CSS variables the page colours are driven by.
 */
export const TIME_OF_DAY = {
  damping: 4,
  maxDelta: 0.05,
  snap: 0.001,
  textSwitchCentre: 0.58,
  textSwitchWidth: 0.3,
  cssSteps: 1000,
} as const

/**
 * Shape of the light rays from the window (slice 4.3): `planes` upright sheets across the width of the window, each
 * running from the lit part of the glass along the live sun direction until it meets worktop, back wall or floor. Their
 * strength and colour come from the time of day (`rayStrength` and the sun colour of `LIGHT_PRESETS`). Lengths are in
 * meters, `crossSoftness` is a share of the beam height, noise scales are tiles of the noise texture. In dev the Leva
 * `Rays` folder edits these live (not persisted).
 */
export const RAYS = {
  planes: 10,
  /** The outer sheets are this much weaker than the middle ones (soft sides of the beam). */
  sideDim: 0.4,
  /** Soft top and bottom of the beam. */
  crossSoftness: 0.28,
  /** Fade in from the glass. */
  fadeIn: 0.07,
  /** Fade out towards the surface the ray ends on. */
  endFade: 0.09,
  /** Soft border of those surfaces, so rays that just miss an edge do not differ by a hard step. */
  edgeMargin: 0.04,
  /** Long rays (the low evening sun passes the worktop) dissolve between these distances from the glass. */
  reachStart: 0.5,
  reachEnd: 0.95,
  /** The rays fade out when the sun direction's x (towards the room) drops from the second value to the first. */
  visibleFrom: [0.15, 0.4],
  noise: { seed: 71, cells: 4, octaves: 3 },
  /** Streaks: tiles across the height of the beam, shift from one side to the other, tiles per meter along the beam. */
  noiseAcross: 2.2,
  noiseSide: 0.5,
  noiseAlong: 0.35,
  /** How fast the streaks wander (noise tiles per second). */
  drift: 0.012,
  /** Noise values mapped to dark and bright streaks, and the share of light left between them. */
  cutLow: 0.36,
  cutHigh: 0.66,
  base: 0.3,
  /** The shadow of the horizontal cross bar: share of light removed and softness of its edges. */
  mullionDim: 0.6,
  mullionSoftness: 0.012,
} as const

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
  /**
   * Do the four tea bag packets (`TeaBag_0..3`, slice D3) cast a shadow? No: each caster is one more draw call in the shadow
   * pass and a packet's shadow would fall on the box and its neighbours, a few millimetres of darkening nobody sees (D-099).
   * They always receive, so the box rim and the window mullion can shade them.
   */
  teaBagsCast: false,
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
    hero: { azimuth: 25, polar: 68, distance: 2.3 },
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
    distanceMin: 1.9,
    distanceMax: 3.2,
  },
} as const satisfies { presets: Record<string, CameraPose> } & Record<string, unknown>

export type CameraPresetName = keyof typeof CAMERA.presets

/**
 * Tea selection (slice 3.1). `bagLift` is how far the active tea bag stands above the others (meters, relative to its
 * rest position in the model). The damping values are `MathUtils.damp` lambdas (higher = faster): about 4 reaches 99 %
 * after 1.2 s, so colour, density and speed settle inside the 2 s of the SPEC criterion without a visible jump.
 * `maxDelta` caps the time step so a long frame (tab switch) cannot make a damped value jump in one step.
 * `hitPadding` grows the invisible click box of each bag beyond its mesh (meters per side, x and y only). The box is
 * deliberately thinner than the bag in depth (`hitDepth`, total meters): seen from the side (azimuth 40) the bags overlap
 * on screen, and a deep box of the neighbour in front would catch a click aimed at the bag behind it.
 */
export const TEA_SELECT = {
  bagLift: 0.015,
  bagDamping: 8,
  teaDamping: 4,
  maxDelta: 0.1,
  hitPadding: { x: 0.002, y: 0.008 },
  hitDepth: 0.014,
} as const
