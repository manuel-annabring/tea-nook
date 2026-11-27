import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { TextureLoader, type Group, type Object3D } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { AO, CAMERA } from '../config/look.ts'
import type { BeamWindow } from '../lib/beam.ts'
import { TeaBagHits } from '../input/TeaInput.tsx'
import { useTeaHoverCursor } from '../input/useHoverCursor.ts'
import { useMugHandlers } from '../input/useMugHandlers.ts'
import { frameCamera } from '../scene/framing.ts'
import { timeLive } from '../scene/timeOfDayLive.ts'
import { assertContract } from './contract.ts'
import { Model } from './NookModel.generated.tsx'
import { applyPalette } from './palette.ts'
import { applyShadowFlags } from './shadows.ts'
import { applyRoomAo, configureAoTexture, detachRoomAo, ROOM_AO_URL } from './roomAo.ts'
import { readBeamWindow } from './beamWindow.ts'
import { Rays } from './Rays.tsx'
import { Steam } from './Steam.tsx'
import { useStore } from '../store/useStore.ts'
import { createTeaRig, resetTeaRig, tickTeaSelection, type TeaRig } from './teaSelection.ts'
import { applyNookTime, createNookTimeRig, resetNookTimeRig, type NookTimeRig } from './timeOfDayLook.ts'

/**
 * The diorama: the generated model plus behaviour. On mount it checks the model contract (dev only, throws with the
 * missing names), applies the palette and the baked AO texture, frames the camera on the `Orbit_Target` marker once the controls exist, and
 * attaches the two steams to the `Steam_Tea` and `Steam_Kettle` markers, adds the light rays of the window, and handles the tea selection (click on the mug
 * or a bag; the lifted bag and the tea surface colour follow the store's `teaIndex`). The sky card, the glow of the
 * lamp shade and a little self-light on the tea colours follow the time of day (`timeLive`).
 */
export function Nook() {
  const root = useRef<Group>(null)
  const teaMarker = useRef<Object3D>(null)
  const kettleMarker = useRef<Object3D>(null)
  const beamWindow = useRef<BeamWindow>(null)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const controls = useThree((s) => s.controls) as OrbitControls | null
  const framed = useRef(false)
  const teaRig = useRef<TeaRig | null>(null)
  const timeRig = useRef<NookTimeRig | null>(null)
  const mugHandlers = useMugHandlers()
  useTeaHoverCursor()
  // Baked AO of `Room`. Suspends until loaded, so the first frame already has it. We created the texture, so we dispose it.
  const aoTexture = useLoader(TextureLoader, ROOM_AO_URL)

  useLayoutEffect(() => {
    if (!root.current) return
    if (import.meta.env.DEV) assertContract(root.current)
    applyPalette(root.current)
    applyShadowFlags(root.current)
    for (const [name, ref] of [
      ['Steam_Tea', teaMarker],
      ['Steam_Kettle', kettleMarker],
    ] as const) {
      const marker = root.current.getObjectByName(name)
      if (!marker) throw new Error(`${name} is missing from the model (SPEC.md section 5)`)
      ref.current = marker
    }
    beamWindow.current = readBeamWindow(root.current)
  }, [])

  // Bags, their hit boxes and the tea surface material, for the per-frame tea selection (`tickTeaSelection`).
  useLayoutEffect(() => {
    if (!root.current) return
    const rig = createTeaRig(root.current, scene)
    teaRig.current = rig
    return () => {
      resetTeaRig(rig)
      teaRig.current = null
    }
  }, [scene])

  // The sky card, the lamp shade and the tea colours, for the time of day. After the palette, which this overrides from the first frame on.
  useLayoutEffect(() => {
    if (!root.current) return
    const rig = createNookTimeRig(root.current)
    applyNookTime(rig, timeLive.values)
    timeRig.current = rig
    return () => {
      resetNookTimeRig(rig)
      timeRig.current = null
    }
  }, [])

  useFrame((_, delta) => {
    if (teaRig.current) tickTeaSelection(teaRig.current, useStore.getState().teaIndex, delta)
    if (timeRig.current) applyNookTime(timeRig.current, timeLive.values)
  })

  useLayoutEffect(() => {
    const room = root.current?.getObjectByName('Room')
    if (!room) throw new Error('Room is missing from the model (SPEC.md section 5)')
    configureAoTexture(aoTexture)
    applyRoomAo(room, aoTexture, AO.intensity)
    return () => {
      detachRoomAo(room)
      // Only free the GPU copy. The loader cache keeps the texture, so a StrictMode remount in dev finds it again
      // instead of suspending the whole model.
      aoTexture.dispose()
    }
  }, [aoTexture])

  useLayoutEffect(() => {
    if (framed.current || !controls || !root.current) return
    const marker = root.current.getObjectByName('Orbit_Target')
    if (!marker) throw new Error('Orbit_Target is missing from the model (SPEC.md section 5)')
    frameCamera(camera, controls, marker, CAMERA.presets.hero)
    framed.current = true
  }, [camera, controls])

  return (
    <>
      <Model ref={root} {...mugHandlers} />
      <TeaBagHits />
      <Steam slot="tea" anchor={teaMarker} />
      <Steam slot="kettle" anchor={kettleMarker} />
      <Rays window={beamWindow} />
    </>
  )
}
