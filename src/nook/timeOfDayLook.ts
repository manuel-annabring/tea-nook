// The parts of the model that change with the time of day: the sky card behind the window, the glow of the lamp and a
// little self-light on the four tea colours.

import { MeshStandardMaterial, type Mesh, type Object3D } from 'three'
import { LIGHT_PRESETS, PALETTE } from '../config/look.ts'
import type { TimeValues } from '../lib/timeOfDay.ts'
import { TEA_BAG_NAMES } from './contract.ts'

export interface NookTimeRig {
  /** Material of `Window_Sky` (`Mat_Sky`). */
  sky: MeshStandardMaterial
  /** The shade material `Mat_Lamp`, one of the materials of `Room`. */
  lamp: MeshStandardMaterial
  /** The materials of the four tea bags (`Mat_Bag0..3`, shared with the jar contents in `Room`). */
  bags: MeshStandardMaterial[]
}

/** Finds the materials in the mounted model, by contract names only. Throws with the missing name. */
export function createNookTimeRig(root: Object3D): NookTimeRig {
  const sky = (root.getObjectByName('Window_Sky') as Mesh | undefined)?.material
  if (!(sky instanceof MeshStandardMaterial)) throw new Error('Window_Sky is missing from the model (SPEC.md section 5)')
  let lamp: MeshStandardMaterial | undefined
  root.getObjectByName('Room')?.traverse((node) => {
    const material = (node as Mesh).material
    if (material instanceof MeshStandardMaterial && material.name === 'Mat_Lamp') lamp = material
  })
  if (!lamp) throw new Error('Mat_Lamp is missing from Room (SPEC.md section 5)')
  const bags = TEA_BAG_NAMES.map((name) => {
    const material = (root.getObjectByName(name) as Mesh | undefined)?.material
    if (!(material instanceof MeshStandardMaterial)) throw new Error(`${name} is missing from the model (SPEC.md section 5)`)
    return material
  })
  return { sky, lamp, bags }
}

/**
 * Copies the live time values into those materials (per frame, allocation free). Only colours and the emissive
 * strength change, so no shader program is recompiled.
 */
export function applyNookTime(rig: NookTimeRig, v: TimeValues): void {
  rig.sky.color.copy(v.skyColor)
  rig.sky.emissive.copy(v.skyColor)
  rig.sky.emissiveIntensity = v.skyGlow
  rig.lamp.emissive.copy(v.lampGlowColor)
  rig.lamp.emissiveIntensity = v.lampGlow
  for (let i = 0; i < rig.bags.length; i += 1) {
    const bag = rig.bags[i] as MeshStandardMaterial
    bag.emissive.copy(bag.color)
    bag.emissiveIntensity = v.bagGlow
  }
}

/** Puts the materials back to daylight (they belong to the model cache and outlive the component). */
export function resetNookTimeRig(rig: NookTimeRig): void {
  rig.sky.color.set(LIGHT_PRESETS.morning.skyColor)
  rig.sky.emissive.set('#000000')
  rig.sky.emissiveIntensity = 1
  rig.lamp.color.set(PALETTE.Mat_Lamp)
  rig.lamp.emissive.set('#000000')
  rig.lamp.emissiveIntensity = 1
  for (const bag of rig.bags) {
    bag.emissive.set('#000000')
    bag.emissiveIntensity = 1
  }
}
