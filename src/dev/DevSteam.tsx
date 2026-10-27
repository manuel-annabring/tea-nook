import { useControls } from 'leva'
import { useEffect, useRef } from 'react'
import { STEAM_LOOK_DEFAULTS as D, type SteamLook } from '../nook/steamDefaults.ts'
import { Steam } from '../nook/Steam.tsx'
import { TEAS } from '../lib/teas.ts'
import { MUG_HEIGHT } from '../scene/placeholder.ts'
import { PointerMarker } from './PointerMarker.tsx'

const TEA_NAMES = TEAS.map((t) => t.name)

/** Dev-only steam with a Leva tweak panel. Loaded lazily under import.meta.env.DEV, so it is not in the production bundle. */
export default function DevSteam() {
  const [steam, setSteam] = useControls('Steam', () => ({
    tea: { value: TEA_NAMES[0] ?? '', options: TEA_NAMES },
    color: D.color,
    density: { value: D.density, min: 0, max: 1.5, step: 0.01 },
    speed: { value: D.speed, min: 0, max: 3, step: 0.01 },
    height: { value: D.height, min: 0.1, max: 0.5, step: 0.005 },
    radius: { value: D.radius, min: 0.01, max: 0.08, step: 0.001 },
  }))

  // Picking a tea loads its preset values into the sliders; they stay editable afterwards.
  const prevTea = useRef(steam.tea)
  useEffect(() => {
    if (prevTea.current === steam.tea) return
    prevTea.current = steam.tea
    const tea = TEAS.find((t) => t.name === steam.tea)
    if (tea) setSteam({ color: tea.steamColor, density: tea.density, speed: tea.speed })
  }, [steam.tea, setSteam])

  const noise = useControls('Noise', {
    scaleAround: { value: D.noiseScaleX, min: 0.25, max: 4, step: 0.25 },
    scaleAlong: { value: D.noiseScaleY, min: 0.2, max: 3, step: 0.05 },
    cutLow: { value: D.cutLow, min: 0, max: 1, step: 0.01 },
    cutHigh: { value: D.cutHigh, min: 0, max: 1, step: 0.01 },
    wind: { value: D.wind, min: 0, max: 0.15, step: 0.005 },
    facing: { value: D.facing, min: 0, max: 1, step: 0.01 },
  })
  const shape = useControls('Shape', {
    twistMax: { value: D.shape.twistMax, min: 0, max: 12, step: 0.1 },
    twistPower: { value: D.shape.twistPower, min: 0.5, max: 4, step: 0.05 },
    fadeIn: { value: D.shape.fadeIn, min: 0.01, max: 0.6, step: 0.01 },
    fadeOut: { value: D.shape.fadeOut, min: 0.2, max: 0.99, step: 0.01 },
  })
  const pointer = useControls('Pointer', {
    radius: { value: D.shape.pointerRadius, min: 0.02, max: 0.14, step: 0.005 },
    strength: { value: D.shape.pointerStrength, min: 0, max: 0.1, step: 0.0025 },
    power: { value: D.shape.pointerPower, min: 0.5, max: 4, step: 0.05 },
    anchor: { value: D.shape.pointerAnchor, min: 0.01, max: 1, step: 0.01 },
    marker: false,
  })

  const look: SteamLook = {
    radius: steam.radius,
    height: steam.height,
    color: steam.color,
    density: steam.density,
    speed: steam.speed,
    noiseScaleX: noise.scaleAround,
    noiseScaleY: noise.scaleAlong,
    cutLow: noise.cutLow,
    cutHigh: noise.cutHigh,
    wind: noise.wind,
    facing: noise.facing,
    shape: {
      twistMax: shape.twistMax,
      twistPower: shape.twistPower,
      fadeIn: shape.fadeIn,
      fadeOut: shape.fadeOut,
      pointerRadius: pointer.radius,
      pointerStrength: pointer.strength,
      pointerPower: pointer.power,
      pointerAnchor: pointer.anchor,
    },
  }

  return (
    <>
      <Steam position={[0, MUG_HEIGHT, 0]} look={look} />
      {pointer.marker && <PointerMarker />}
    </>
  )
}
