import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { RAYS } from '../config/look.ts'
import type { BeamWindow } from '../lib/beam.ts'
import { timeLive } from '../scene/timeOfDayLive.ts'
import { createRaysGeometry } from './raysGeometry.ts'
import { createRaysMaterial, createRaysState, tickRays } from './raysMaterial.ts'
import { createNoiseTexture } from './steamMaterial.ts'

interface RaysProps {
  /** The window as read from the model (`readBeamWindow`); the rays stay unlit until it is there. */
  window: RefObject<BeamWindow | null>
}

/** The rays are light, not an object: pointer rays must pass through them to the mug and the tea bags. */
const noRaycast = () => null

/**
 * Drawn before the other transparent meshes (steam, window glass), whatever the camera does. three would otherwise sort
 * this mesh by its origin, the world origin, and could add the rays on top of a steam that is in front of them; drawn
 * first, the steam always covers them and stays readable.
 */
const RENDER_ORDER = -1

/**
 * Soft light rays from the window along the live sun direction (name `RaysMesh`, never a contract name). One mesh, one
 * draw call, no shadow. Everything that moves is a uniform, updated from `timeLive` in `useFrame`.
 */
export function Rays({ window }: RaysProps) {
  const noise = useMemo(() => createNoiseTexture(RAYS.noise), [])
  const material = useMemo(() => createRaysMaterial(noise), [noise])
  const geometry = useMemo(() => createRaysGeometry(RAYS.planes, RAYS.sideDim), [])
  const state = useRef(createRaysState())

  useEffect(() => () => noise.dispose(), [noise])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    if (window.current) tickRays(material, state.current, window.current, timeLive.values, delta)
  })

  // frustumCulled is off: the vertex shader places the vertices, the geometry's bounding box says nothing about them.
  return <mesh name="RaysMesh" geometry={geometry} material={material} renderOrder={RENDER_ORDER} frustumCulled={false} raycast={noRaycast} />
}
