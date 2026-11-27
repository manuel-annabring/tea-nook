import { LIGHT_PRESETS } from '../config/look.ts'
import { blendTimeValues, compileTimePreset, createTimeValues, type TimeOfDay, type TimeValues } from '../lib/timeOfDay.ts'

/**
 * The compiled presets, one per time of day. The app only reads them; in dev the Leva `Light` folder and
 * `__nook.setLights` edit the active one, and the next frame shows it.
 */
export const timePresets: Readonly<Record<TimeOfDay, TimeValues>> = {
  morning: compileTimePreset(LIGHT_PRESETS.morning),
  evening: compileTimePreset(LIGHT_PRESETS.evening),
}

/**
 * The live time of day: the single damped blend factor (0 morning, 1 evening) and every value derived from it. Written
 * once per frame by `TimeOfDay` (before all other `useFrame` callbacks), read in `useFrame` by whoever draws something
 * that depends on the time: the lights, the sky card, the lamp shade, the steam (and later rays and dust, which also
 * take the sun direction from `values.sunPosition`). Plain mutable data, never React state; do not write to it elsewhere.
 */
export const timeLive: { blend: number; values: TimeValues } = {
  blend: 0,
  values: blendTimeValues(timePresets.morning, timePresets.evening, 0, createTimeValues()),
}
