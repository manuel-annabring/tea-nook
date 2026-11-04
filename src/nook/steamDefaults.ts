import { STEAM_DEFAULTS, type SteamParams } from '../lib/steamMath.ts'
import { TEAS } from '../lib/teas.ts'

export interface SteamLook {
  /** Half the steam width, meters. */
  radius: number
  /** Steam column height, meters. */
  height: number
  color: string
  density: number
  speed: number
  /** Noise tiles across the plane and along the height. */
  noiseScaleX: number
  noiseScaleY: number
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
  radius: 0.05,
  height: 0.23,
  color: firstTea.steamColor,
  density: firstTea.density,
  speed: firstTea.speed,
  noiseScaleX: 1,
  noiseScaleY: 1.55,
  cutLow: 0.27,
  cutHigh: 0.61,
  wind: 0.07,
  facing: 0.47,
  shape: STEAM_DEFAULTS,
}

/** Kettle steam relative to the tea steam (D-028): denser and taller, same noise and twist. */
export const KETTLE_STEAM_DENSITY_FACTOR = 1.4
export const KETTLE_STEAM_HEIGHT_FACTOR = 1.5

export const KETTLE_STEAM_LOOK: SteamLook = {
  ...STEAM_LOOK_DEFAULTS,
  density: STEAM_LOOK_DEFAULTS.density * KETTLE_STEAM_DENSITY_FACTOR,
  height: STEAM_LOOK_DEFAULTS.height * KETTLE_STEAM_HEIGHT_FACTOR,
}
