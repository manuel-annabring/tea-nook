import { useControls } from 'leva'
import { useEffect, useRef } from 'react'
import { TEAS } from '../config/look.ts'
import { KETTLE_STEAM_LOOK, STEAM_LOOK_DEFAULTS, type SteamLook } from '../nook/steamDefaults.ts'
import { useStore, type SteamSlot } from '../store/useStore.ts'
import { PointerMarker } from './PointerMarker.tsx'

/** One Leva folder per steam; writes the look into the store, where `Steam` picks it up. */
function useSteamControls(slot: SteamSlot, title: string, D: SteamLook, withAppearance: boolean) {
  // Colour, density and speed of the tea steam follow the selected tea (D-117): they are edited in `DevActiveTea` instead.
  const appearance = useControls(`${title} / Steam`, withAppearance ? {
    color: D.color,
    density: { value: D.density, min: 0, max: 2, step: 0.01 },
    speed: { value: D.speed, min: 0, max: 3, step: 0.01 },
  } : {})
  const steam = useControls(`${title} / Steam`, {
    height: { value: D.height, min: 0.1, max: 0.6, step: 0.005 },
    radius: { value: D.radius, min: 0.01, max: 0.08, step: 0.001 },
    widthBase: { value: D.widthBase, min: 0.05, max: 1, step: 0.01 },
    widthPower: { value: D.widthPower, min: 0.3, max: 4, step: 0.05 },
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

  const color = withAppearance ? (appearance as { color: string }).color : D.color
  const density = withAppearance ? (appearance as { density: number }).density : D.density
  const speed = withAppearance ? (appearance as { speed: number }).speed : D.speed
  const { height, radius, widthBase, widthPower } = steam
  const { scaleAround, scaleAlong, cutLow, cutHigh, wind, facing } = noise
  const { twistMax, twistPower, fadeIn, fadeOut } = shape

  useEffect(() => {
    const look: SteamLook = {
      radius,
      widthBase,
      widthPower,
      noise: D.noise,
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
  }, [slot, D.noise, radius, widthBase, widthPower, height, color, density, speed, scaleAround, scaleAlong, cutLow, cutHigh, wind, facing, twistMax, twistPower, fadeIn, fadeOut, pointer.radius, pointer.strength, pointer.power, pointer.anchor])
}

/** Dev-only tweak panel for both steams. Loaded lazily under import.meta.env.DEV, so it is not in the production bundle. */
/**
 * Live editing of the SELECTED tea (slice 3 review, Manuel's choice): steam colour, density, speed and liquid colour of
 * `TEAS[teaIndex]`. The sliders show the values of the selected tea and follow a click on the mug or a bag; a change is
 * written into the `TEAS` entry itself (dev only), so the damped steam and tea surface follow. Copy good values into
 * `src/lib/teas.ts`: they are not persisted.
 */
function DevActiveTea() {
  const teaIndex = useStore((s) => s.teaIndex)
  const tea = TEAS[teaIndex]
  const [values, set] = useControls('Active tea (live)', () => ({
    name: { value: tea?.name ?? '', editable: false },
    steamColor: tea?.steamColor ?? '#ffffff',
    density: { value: tea?.density ?? 1, min: 0, max: 2, step: 0.01 },
    speed: { value: tea?.speed ?? 1, min: 0, max: 3, step: 0.01 },
    liquidColor: tea?.liquidColor ?? '#ffffff',
  }))
  const shownIndex = useRef(-1)
  // A new selection: load that tea's values into the sliders (and do not write them back as an edit).
  useEffect(() => {
    if (!tea) return
    shownIndex.current = teaIndex
    set({ name: tea.name, steamColor: tea.steamColor, density: tea.density, speed: tea.speed, liquidColor: tea.liquidColor })
  }, [teaIndex, tea, set])
  // An edit: write the slider values into the selected tea.
  useEffect(() => {
    const target = TEAS[shownIndex.current]
    if (!target) return
    target.steamColor = values.steamColor
    target.density = values.density
    target.speed = values.speed
    target.liquidColor = values.liquidColor
  }, [values.steamColor, values.density, values.speed, values.liquidColor]) // not keyed on the selection: the load effect above sets the sliders first
  return null
}

export default function DevSteam() {
  useSteamControls('tea', 'Tea', STEAM_LOOK_DEFAULTS, false)
  useSteamControls('kettle', 'Kettle', KETTLE_STEAM_LOOK, true)
  const { marker } = useControls('Debug', { marker: false })
  return (
    <>
      <DevActiveTea />
      {marker ? <PointerMarker /> : null}
    </>
  )
}
