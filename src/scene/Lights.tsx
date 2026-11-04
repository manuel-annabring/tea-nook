import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3, type DirectionalLight } from 'three'
import { LIGHT_PRESETS, SHADOW } from '../config/look.ts'
import { getShadowMode } from './shadowMode.ts'

const { morning } = LIGHT_PRESETS
const mode = getShadowMode()
const sunDistance = new Vector3(...morning.sunPosition).length()

/**
 * Morning lights: a hemisphere fill and one directional sun with one shadow map. The sun shines from the window side
 * (-X) at the world origin; the shadow camera is fitted to the diorama (`SHADOW` in look.ts). Static mode renders the
 * shadow map once, after the model has mounted, because nothing that casts a shadow moves.
 */
export function Lights() {
  const sun = useRef<DirectionalLight>(null)
  const scene = useThree((s) => s.scene)
  const mountedFrames = useRef(0)

  useFrame(() => {
    const light = sun.current
    if (mode !== 'static' || !light || mountedFrames.current > 2) return
    // The model suspends while it loads: freeze the map only after the Mug (a caster) has been in the scene for 2 frames.
    if (!scene.getObjectByName('Mug')) return
    mountedFrames.current += 1
    if (mountedFrames.current === 2) {
      light.shadow.autoUpdate = false
      light.shadow.needsUpdate = true // renders once more on the next frame, then stays frozen
    }
  })

  return (
    <>
      <hemisphereLight args={[morning.fillSkyColor, morning.fillGroundColor, morning.fillIntensity]} />
      <directionalLight
        ref={sun}
        color={morning.sunColor}
        intensity={morning.sunIntensity}
        position={[...morning.sunPosition]}
        castShadow={mode !== 'off'}
        shadow-mapSize={[SHADOW.mapSize, SHADOW.mapSize]}
        shadow-radius={SHADOW.radius}
        shadow-bias={SHADOW.bias}
        shadow-normalBias={SHADOW.normalBias}
        shadow-camera-left={SHADOW.left}
        shadow-camera-right={SHADOW.right}
        shadow-camera-top={SHADOW.top}
        shadow-camera-bottom={SHADOW.bottom}
        shadow-camera-near={Math.max(0.05, sunDistance - SHADOW.near)}
        shadow-camera-far={sunDistance + SHADOW.far}
      />
    </>
  )
}
