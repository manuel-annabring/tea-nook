import { useControls } from 'leva'
import { useEffect } from 'react'
import { KETTLE_STEAM_LOOK, STEAM_LOOK_DEFAULTS, type SteamLook } from '../nook/steamDefaults.ts'
import { useStore, type SteamSlot } from '../store/useStore.ts'
import { PointerMarker } from './PointerMarker.tsx'

/** One Leva folder per steam; writes the look into the store, where `Steam` picks it up. */
function useSteamControls(slot: SteamSlot, title: string, D: SteamLook) {
  const steam = useControls(`${title} / Steam`, {
    color: D.color,
    density: { value: D.density, min: 0, max: 2, step: 0.01 },
    speed: { value: D.speed, min: 0, max: 3, step: 0.01 },
    height: { value: D.height, min: 0.1, max: 0.6, step: 0.005 },
    radius: { value: D.radius, min: 0.01, max: 0.08, step: 0.001 },
  })
  const noise = useControls(`${title} / Noise`, {
    scaleAround: { value: D.noiseScaleX, min: 0.25, max: 4, step: 0.25 },
    scaleAlong: { value: D.noiseScaleY, min: 0.2, max: 3, step: 0.05 },
    cutLow: { value: D.cutLow, min: 0, max: 1, step: 0.01 },
    cutHigh: { value: D.cutHigh, min: 0, max: 1, step: 0.01 },
    wind: { value: D.wind, min: 0, max: 0.15, step: 0.005 },
    facing: { value: D.facing, min: 0, max: 1, step: 0.01 },
  })
  const shape = useControls(`${title} / Shape`, {
    twistMax: { value: D.shape.twistMax, min: 0, max: 12, step: 0.1 },
    twistPower: { value: D.shape.twistPower, min: 0.5, max: 4, step: 0.05 },
    fadeIn: { value: D.shape.fadeIn, min: 0.01, max: 0.6, step: 0.01 },
    fadeOut: { value: D.shape.fadeOut, min: 0.2, max: 0.99, step: 0.01 },
  })
  const pointer = useControls(`${title} / Pointer`, {
    radius: { value: D.shape.pointerRadius, min: 0.02, max: 0.14, step: 0.005 },
    strength: { value: D.shape.pointerStrength, min: 0, max: 0.1, step: 0.0025 },
    power: { value: D.shape.pointerPower, min: 0.5, max: 4, step: 0.05 },
    anchor: { value: D.shape.pointerAnchor, min: 0.01, max: 1, step: 0.01 },
  })

  const { color, density, speed, height, radius } = steam
  const { scaleAround, scaleAlong, cutLow, cutHigh, wind, facing } = noise
  const { twistMax, twistPower, fadeIn, fadeOut } = shape

  useEffect(() => {
    const look: SteamLook = {
      radius,
      height,
      color,
      density,
      speed,
      noiseScaleX: scaleAround,
      noiseScaleY: scaleAlong,
      cutLow,
      cutHigh,
      wind,
      facing,
      shape: {
        twistMax,
        twistPower,
        fadeIn,
        fadeOut,
        pointerRadius: pointer.radius,
        pointerStrength: pointer.strength,
        pointerPower: pointer.power,
        pointerAnchor: pointer.anchor,
      },
    }
    useStore.getState().setSteamLook(slot, look)
  }, [slot, radius, height, color, density, speed, scaleAround, scaleAlong, cutLow, cutHigh, wind, facing, twistMax, twistPower, fadeIn, fadeOut, pointer.radius, pointer.strength, pointer.power, pointer.anchor])
}

/** Dev-only tweak panel for both steams. Loaded lazily under import.meta.env.DEV, so it is not in the production bundle. */
export default function DevSteam() {
  useSteamControls('tea', 'Tea', STEAM_LOOK_DEFAULTS)
  useSteamControls('kettle', 'Kettle', KETTLE_STEAM_LOOK)
  const { marker } = useControls('Debug', { marker: false })
  return marker ? <PointerMarker /> : null
}
