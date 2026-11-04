import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import type { Group } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CAMERA } from '../config/look.ts'
import { frameCamera } from '../scene/framing.ts'
import { assertContract } from './contract.ts'
import { Model } from './NookModel.generated.tsx'
import { applyPalette } from './palette.ts'

/**
 * The diorama: the generated model plus behaviour. On mount it checks the model contract (dev only, throws with the
 * missing names), applies the palette, and frames the camera on the `Orbit_Target` marker once the controls exist.
 */
export function Nook() {
  const root = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControls | null
  const framed = useRef(false)

  useLayoutEffect(() => {
    if (!root.current) return
    if (import.meta.env.DEV) assertContract(root.current)
    applyPalette(root.current)
  }, [])

  useLayoutEffect(() => {
    if (framed.current || !controls || !root.current) return
    const marker = root.current.getObjectByName('Orbit_Target')
    if (!marker) throw new Error('Orbit_Target is missing from the model (SPEC.md section 5)')
    frameCamera(camera, controls, marker, CAMERA.presets.hero)
    framed.current = true
  }, [camera, controls])

  return <Model ref={root} />
}
