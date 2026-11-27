import { Vector3, type Object3D } from 'three'
import { dustBoxFrom, type DustBox } from '../lib/dust.ts'

/** The box the dust floats in, between the markers `Dust_Min` and `Dust_Max` of the mounted model. Throws with the missing name. */
export function readDustBox(root: Object3D): DustBox {
  const corner = (name: 'Dust_Min' | 'Dust_Max') => {
    const marker = root.getObjectByName(name)
    if (!marker) throw new Error(`${name} is missing from the model (SPEC.md section 5)`)
    return marker.getWorldPosition(new Vector3())
  }
  return dustBoxFrom(corner('Dust_Min'), corner('Dust_Max'))
}
