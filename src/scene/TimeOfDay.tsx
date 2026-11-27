import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { TIME_OF_DAY } from '../config/look.ts'
import { blendTimeValues, stepTimeBlend, textBlend, TIME_BLEND } from '../lib/timeOfDay.ts'
import { useStore } from '../store/useStore.ts'
import { applyTimeToScene, createTimeSceneRig, type TimeSceneRig } from './lightRig.ts'
import { createPageTheme, writePageTheme } from './pageTheme.ts'
import { timeLive, timePresets } from './timeOfDayLive.ts'

/** Runs before the other `useFrame` callbacks (a negative priority does not take over r3f's rendering). */
const TIME_PRIORITY = -1

/**
 * The one driver of the time of day: each frame it damps the blend factor towards the store's `timeOfDay`, derives
 * every live value from it (`timeLive`) and copies the scene-level ones into the lights, the canvas background and the
 * CSS variables of the page. Parts of the model and the steam copy their values from `timeLive` in their own
 * `useFrame`, which runs after this one. The first frame snaps to the selected time. Mount it after `Lights`.
 */
export function TimeOfDay() {
  const scene = useThree((s) => s.scene)
  const rig = useRef<TimeSceneRig | null>(null)
  const page = useRef(createPageTheme())

  useLayoutEffect(() => {
    rig.current = createTimeSceneRig(scene)
    timeLive.blend = TIME_BLEND[useStore.getState().timeOfDay]
    return () => {
      rig.current = null
    }
  }, [scene])

  useFrame((_, delta) => {
    const target = TIME_BLEND[useStore.getState().timeOfDay]
    timeLive.blend = stepTimeBlend(timeLive.blend, target, delta, TIME_OF_DAY)
    blendTimeValues(timePresets.morning, timePresets.evening, timeLive.blend, timeLive.values)
    if (rig.current) applyTimeToScene(rig.current, timeLive.values)
    writePageTheme(page.current, timeLive.blend, textBlend(timeLive.blend, TIME_OF_DAY.textSwitchCentre, TIME_OF_DAY.textSwitchWidth))
  }, TIME_PRIORITY)

  return null
}
