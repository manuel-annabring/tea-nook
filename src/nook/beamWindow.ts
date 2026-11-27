import { Box3, Vector3, type Object3D } from 'three'
import type { BeamWindow } from '../lib/beam.ts'

/**
 * The window the sun comes through, read from the mounted model by contract names: its centre from the `Rays_Origin`
 * marker, its size from the world bounds of `Window_Glass`. Throws with the missing name.
 */
export function readBeamWindow(root: Object3D): BeamWindow {
  const origin = root.getObjectByName('Rays_Origin')
  if (!origin) throw new Error('Rays_Origin is missing from the model (SPEC.md section 5)')
  const glass = root.getObjectByName('Window_Glass')
  if (!glass) throw new Error('Window_Glass is missing from the model (SPEC.md section 5)')
  const centre = origin.getWorldPosition(new Vector3())
  glass.updateWorldMatrix(true, true)
  const size = new Box3().setFromObject(glass).getSize(new Vector3())
  return { x: centre.x, y: centre.y, z: centre.z, halfHeight: size.y / 2, halfWidth: size.z / 2 }
}
