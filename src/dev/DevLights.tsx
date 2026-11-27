import { useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useRef, useState } from 'react'
import { PALETTE } from '../config/look.ts'
import { patchTimeValues, readTimeValues, type TimePatch } from '../lib/timeOfDay.ts'
import { setPaletteColor } from '../nook/palette.ts'
import { timePresets } from '../scene/timeOfDayLive.ts'
import { useStore } from '../store/useStore.ts'

/** Wall colour suggestions (Manuel's review of phase 2); the first entry that equals the default is selected at start. */
const WALL_PRESETS = {
  'Taupe (default)': '#937E6C',
  'Dusty blue': '#C8D7DC',
  Sage: '#C9D6BE',
  Rose: '#EBCFC0',
  Butter: '#F3E3B0',
  'Original cream': '#F2E6D0',
} as const

/** What the sliders show for a preset (angles rounded for display; only a value changed in the panel is written back). */
function sliderValues(patch: TimePatch): TimePatch {
  const round = (v: number) => Math.round(v * 10) / 10
  return { ...patch, sunAzimuth: round(patch.sunAzimuth), sunAltitude: round(patch.sunAltitude) }
}

/** Writes one panel edit into the preset of the active time of day. Programmatic updates of the sliders are ignored. */
function edit(key: keyof TimePatch) {
  return (value: unknown, _path: string, context: { initial: boolean; fromPanel?: boolean }) => {
    if (context.initial || !context.fromPanel) return
    patchTimeValues(timePresets[useStore.getState().timeOfDay], { [key]: value })
  }
}

/** The `Light` folder: edits the preset of the selected time of day and follows the toggle. */
function useLightFolder() {
  const timeOfDay = useStore((s) => s.timeOfDay)
  const [start] = useState(() => sliderValues(readTimeValues(timePresets[useStore.getState().timeOfDay])))
  const number = (key: keyof TimePatch, label: string, min: number, max: number, step: number) => ({
    value: start[key] as number,
    min,
    max,
    step,
    label,
    onChange: edit(key),
  })
  const color = (key: keyof TimePatch, label: string) => ({ value: start[key] as string, label, onChange: edit(key) })
  const [, set] = useControls('Light', () => ({
    editing: { value: useStore.getState().timeOfDay as string, editable: false, label: 'preset' },
    sunAzimuth: number('sunAzimuth', 'sun azimuth', -180, 180, 0.1),
    sunAltitude: number('sunAltitude', 'sun elevation', 5, 85, 0.1),
    sunIntensity: number('sunIntensity', 'sun intensity', 0, 10, 0.1),
    sunColor: color('sunColor', 'sun colour'),
    hemisphereIntensity: number('hemisphereIntensity', 'fill intensity', 0, 8, 0.05),
    hemisphereSkyColor: color('hemisphereSkyColor', 'fill sky colour'),
    hemisphereGroundColor: color('hemisphereGroundColor', 'fill ground colour'),
    frontIntensity: number('frontIntensity', 'front fill intensity', 0, 5, 0.05),
    frontColor: color('frontColor', 'front fill colour'),
    lampIntensity: number('lampIntensity', 'lamp intensity', 0, 1, 0.005),
    lampColor: color('lampColor', 'lamp colour'),
    lampGlow: number('lampGlow', 'shade glow', 0, 2, 0.01),
    lampGlowColor: color('lampGlowColor', 'shade glow colour'),
    skyColor: color('skyColor', 'sky card colour'),
    skyGlow: number('skyGlow', 'sky card glow', 0, 2, 0.01),
    bagGlow: number('bagGlow', 'tea colour glow', 0, 1, 0.01),
    steamTint: color('steamTint', 'steam tint'),
    steamOpacity: number('steamOpacity', 'steam opacity', 0, 2, 0.01),
    rayStrength: number('rayStrength', 'ray strength', 0, 1, 0.005),
    dustStrength: number('dustStrength', 'dust brightness', 0, 1, 0.005),
  }))

  useEffect(() => {
    set({ editing: timeOfDay, ...sliderValues(readTimeValues(timePresets[timeOfDay])) })
  }, [timeOfDay, set])
}

/**
 * Dev-only: Light and Look folders in the Leva panel. Loaded lazily under import.meta.env.DEV, so it is not in the
 * production bundle. Values are not persisted: copy good ones into `LIGHT_PRESETS` in `look.ts`.
 */
export default function DevLights() {
  const scene = useThree((s) => s.scene)
  useLightFolder()

  const [look, setLook] = useControls('Look', () => ({
    wallPreset: {
      value: PALETTE.Mat_Wall,
      options: WALL_PRESETS,
      label: 'wall preset',
    },
    wall: { value: PALETTE.Mat_Wall, label: 'wall colour' },
  }))

  // Picking a preset copies its colour into the colour picker (the picker stays editable on its own afterwards).
  const preset = look.wallPreset
  const lastPreset = useRef(preset)
  useEffect(() => {
    if (lastPreset.current === preset) return
    lastPreset.current = preset
    setLook({ wall: preset })
  }, [preset, setLook])

  const wall = look.wall
  useEffect(() => {
    setPaletteColor(scene, 'Mat_Wall', wall)
  }, [scene, wall])

  return null
}
