import { useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import { useEffect, useRef } from 'react'
import { LIGHT_PRESETS, PALETTE } from '../config/look.ts'
import { sunAnglesFromPosition } from '../lib/sunAngles.ts'
import { setPaletteColor } from '../nook/palette.ts'
import { applyLightLook } from '../scene/lightRig.ts'

const { morning } = LIGHT_PRESETS
const sunStart = sunAnglesFromPosition(morning.sunPosition)

/** Wall colour suggestions (Manuel's review of phase 2); the first entry that equals the default is selected at start. */
const WALL_PRESETS = {
  'Dusty blue': '#C8D7DC',
  Sage: '#C9D6BE',
  Rose: '#EBCFC0',
  Butter: '#F3E3B0',
  'Original cream': '#F2E6D0',
} as const

/** Dev-only: Light and Look folders in the Leva panel. Loaded lazily under import.meta.env.DEV, so it is not in the production bundle. */
export default function DevLights() {
  const scene = useThree((s) => s.scene)

  const light = useControls('Light', {
    sunAzimuth: { value: Math.round(sunStart.azimuth * 10) / 10, min: -180, max: 180, step: 1, label: 'sun azimuth' },
    sunElevation: { value: Math.round(sunStart.elevation * 10) / 10, min: 5, max: 85, step: 1, label: 'sun elevation' },
    sunIntensity: { value: morning.sunIntensity, min: 0, max: 10, step: 0.1, label: 'sun intensity' },
    sunColor: { value: morning.sunColor, label: 'sun colour' },
    hemisphereIntensity: { value: morning.fillIntensity, min: 0, max: 8, step: 0.1, label: 'fill intensity' },
    frontIntensity: { value: morning.frontFillIntensity, min: 0, max: 5, step: 0.05, label: 'front fill intensity' },
    frontColor: { value: morning.frontFillColor, label: 'front fill colour' },
  })

  const [look, setLook] = useControls('Look', () => ({
    wallPreset: {
      value: PALETTE.Mat_Wall,
      options: WALL_PRESETS,
      label: 'wall preset',
    },
    wall: { value: PALETTE.Mat_Wall, label: 'wall colour' },
  }))

  const { sunAzimuth, sunElevation, sunIntensity, sunColor, hemisphereIntensity, frontIntensity, frontColor } = light
  useEffect(() => {
    applyLightLook(scene, { sunAzimuth, sunElevation, sunIntensity, sunColor, hemisphereIntensity, frontIntensity, frontColor })
  }, [scene, sunAzimuth, sunElevation, sunIntensity, sunColor, hemisphereIntensity, frontIntensity, frontColor])

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
