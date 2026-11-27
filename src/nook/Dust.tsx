import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { BeamWindow } from '../lib/beam.ts'
import type { DustBox } from '../lib/dust.ts'
import { timeLive } from '../scene/timeOfDayLive.ts'
import { createDustGeometry, createDustMaterial, createDustState, tickDust } from './dustMaterial.ts'

interface DustProps {
  /** The box between the dust markers (`readDustBox`); nothing is lit until it and the window are there. */
  box: RefObject<DustBox | null>
  /** The window as read from the model (`readBeamWindow`). */
  window: RefObject<BeamWindow | null>
}

/** Motes are not objects: pointer rays must pass through them to the mug and the tea bags. */
const noRaycast = () => null

/**
 * Like the rays, drawn before the other transparent meshes (steam, window glass): three would sort these points by
 * their origin, the world origin, and could add motes on top of a steam in front of them. Drawn first, the steam
 * covers them and stays readable. Between dust and rays the order does not matter, both only add light.
 */
const RENDER_ORDER = -1

/**
 * Dust motes drifting between `Dust_Min` and `Dust_Max`, brighter inside the window beam (name `DustMesh`, never a
 * contract name). `Points`: every vertex is drawn as one small square facing the camera, here shaded round. One draw
 * call, no shadow. They move in the vertex shader; `useFrame` only writes uniforms.
 */
export function Dust({ box, window }: DustProps) {
  const material = useMemo(() => createDustMaterial(), [])
  const geometry = useMemo(() => createDustGeometry(), [])
  const state = useRef(createDustState())

  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ gl }, delta) => {
    if (!box.current || !window.current) return
    gl.getDrawingBufferSize(state.current.buffer)
    tickDust(material, state.current, box.current, window.current, timeLive.values, delta)
  })

  // frustumCulled is off: the vertex shader places the points, the geometry's bounding box says nothing about them.
  return <points name="DustMesh" geometry={geometry} material={material} renderOrder={RENDER_ORDER} frustumCulled={false} raycast={noRaycast} />
}
