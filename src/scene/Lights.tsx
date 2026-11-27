import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import type { DirectionalLight, PointLight } from 'three'
import { LIGHT_PRESETS, SHADOW } from '../config/look.ts'
import { fitSunShadow, LIGHT_NAMES, measureShadowBounds } from './lightRig.ts'
import { getShadowMode } from './shadowMode.ts'

const { morning } = LIGHT_PRESETS
const mode = getShadowMode()

/**
 * The lights: a hemisphere fill, one directional sun with one shadow map, a weak shadowless front fill from the camera
 * side and the point light of the pendant lamp. The values here are the morning start values; `TimeOfDay` (mounted
 * after this component) overwrites them every frame with the blend of the two presets. The sun shines from the window
 * side (-X) at the world origin. Its shadow camera is fitted to the diorama's bounding box by `fitSunShadow` once the
 * model is in the scene (and again whenever the sun moves, see `applyTimeToScene`). Static mode renders the shadow map
 * after each fit only, because nothing that casts a shadow moves. The lamp light casts no shadow (a point light shadow
 * costs six more passes) and is always in the scene, with intensity 0 in the morning, so no shader is ever recompiled
 * for it; it is placed on the `Lamp_Light` marker as soon as the model is there.
 */
export function Lights() {
  const sun = useRef<DirectionalLight>(null)
  const lamp = useRef<PointLight>(null)
  const scene = useThree((s) => s.scene)
  const fitted = useRef(false)
  const mountedFrames = useRef(0)

  useFrame(() => {
    const light = sun.current
    if (!light) return
    // The model suspends while it loads: fit and freeze only once the casters have been in the scene for a frame.
    if (!fitted.current) {
      if (!measureShadowBounds(scene)) return
      const marker = scene.getObjectByName('Lamp_Light')
      if (!marker) throw new Error('Lamp_Light is missing from the model (SPEC.md section 5)')
      if (lamp.current) marker.getWorldPosition(lamp.current.position)
      fitSunShadow(light)
      fitted.current = true
      return
    }
    if (mode !== 'static' || mountedFrames.current > 2) return
    mountedFrames.current += 1
    if (mountedFrames.current === 2) {
      light.shadow.autoUpdate = false
      light.shadow.needsUpdate = true // renders once more on the next frame, then stays frozen
    }
  })

  return (
    <>
      <hemisphereLight name={LIGHT_NAMES.hemisphere} args={[morning.fillSkyColor, morning.fillGroundColor, morning.fillIntensity]} />
      <directionalLight
        ref={sun}
        name={LIGHT_NAMES.sun}
        color={morning.sunColor}
        intensity={morning.sunIntensity}
        position={[...morning.sunPosition]}
        castShadow={mode !== 'off'}
        shadow-mapSize={[SHADOW.mapSize, SHADOW.mapSize]}
        shadow-radius={SHADOW.radius}
        shadow-bias={SHADOW.bias}
        shadow-normalBias={SHADOW.normalBias}
      />
      <directionalLight
        name={LIGHT_NAMES.front}
        color={morning.frontFillColor}
        intensity={morning.frontFillIntensity}
        position={[...morning.frontFillPosition]}
      />
      <pointLight ref={lamp} name={LIGHT_NAMES.lamp} color={morning.lampColor} intensity={morning.lampIntensity} />
    </>
  )
}
