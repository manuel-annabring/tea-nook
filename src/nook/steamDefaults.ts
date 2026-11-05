import { STEAM_DEFAULTS, type SteamParams } from '../lib/steamMath.ts'
import { TEAS } from '../lib/teas.ts'

/** Parameters of the tileable Perlin texture; each steam uses its own so the patterns differ. */
export interface SteamNoise {
  seed: number
  cells: number
  octaves: number
}

export interface SteamLook {
  /** Half the steam width at the top (h = 1), meters. */
  radius: number
  /** Steam column height, meters. */
  height: number
  color: string
  density: number
  speed: number
  /** Noise tiles across the plane and along the height. */
  noiseScaleX: number
  noiseScaleY: number
  /** Width multiplier at the opening (h = 0) and curve power towards the top; see `steamWidth`. */
  widthBase: number
  widthPower: number
  noise: SteamNoise
  /** Alpha ramps from cutLow to cutHigh noise values. */
  cutLow: number
  cutHigh: number
  /** Lateral drift at the top, meters. */
  wind: number
  /** 0..1: fade surfaces that face away from the camera. */
  facing: number
  shape: SteamParams
}

const firstTea = TEAS[0]
if (!firstTea) throw new Error('TEAS is empty')

export const STEAM_LOOK_DEFAULTS: SteamLook = {
  // Tuned by Manuel in the Leva panel on 2026-10-27.
  // F2 (2026-11-05): radius 0.05 -> 0.04, height 0.23 -> 0.18, noiseScaleY 1.55 -> 1.0 (longer streaks), mild taper.
  radius: 0.04,
  height: 0.18,
  color: firstTea.steamColor,
  density: firstTea.density,
  speed: firstTea.speed,
  widthBase: 0.8,
  widthPower: 1,
  noise: { seed: 7, cells: 4, octaves: 2 },
  noiseScaleX: 1,
  noiseScaleY: 1.0,
  cutLow: 0.27,
  cutHigh: 0.61,
  wind: 0.07,
  facing: 0.47,
  shape: STEAM_DEFAULTS,
}

/** Kettle steam relative to the tea steam (D-028): denser and taller. F2 gives it its own noise, width profile and radius. */
export const KETTLE_STEAM_DENSITY_FACTOR = 1.4
export const KETTLE_STEAM_HEIGHT_FACTOR = 1.5
/** The tea steam height before F2 (0.23); the kettle keeps its D-028 height of 0.23 * 1.5 although the tea steam got lower. */
const KETTLE_HEIGHT_BASE = 0.23

export const KETTLE_STEAM_LOOK: SteamLook = {
  ...STEAM_LOOK_DEFAULTS,
  density: STEAM_LOOK_DEFAULTS.density * KETTLE_STEAM_DENSITY_FACTOR,
  height: KETTLE_HEIGHT_BASE * KETTLE_STEAM_HEIGHT_FACTOR,
  radius: 0.055,
  widthBase: 0.22,
  widthPower: 1.3,
  noise: { seed: 23, cells: 3, octaves: 3 },
  noiseScaleX: 1,
  noiseScaleY: 0.8,
}
