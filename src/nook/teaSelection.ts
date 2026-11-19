import { Color, MathUtils, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { TEA_SELECT, TEAS } from '../config/look.ts'
import { TEA_BAG_NAMES } from './contract.ts'

export const TEA_BAG_HIT_PREFIX = 'TeaBagHit_'

interface BagRig {
  bag: Object3D
  hit: Object3D
  /** Rest heights, read once from the model (never hard-coded). */
  bagRestY: number
  hitRestY: number
}

/** Everything the per-frame tea selection update touches. Built once from the mounted model. */
export interface TeaRig {
  bags: BagRig[]
  surface: MeshStandardMaterial
  target: Color
  targetIndex: number
}

/** Collects the four bags (under the model `root`), their hit boxes (siblings of the model, found from the `scene`) their hit boxes and the tea surface material. Throws with the missing name. */
export function createTeaRig(root: Object3D, scene: Object3D): TeaRig {
  const bags = TEA_BAG_NAMES.map((name, i) => {
    const bag = root.getObjectByName(name)
    const hit = scene.getObjectByName(`${TEA_BAG_HIT_PREFIX}${i}`)
    if (!bag) throw new Error(`${name} is missing from the model (SPEC.md section 5)`)
    if (!hit) throw new Error(`${TEA_BAG_HIT_PREFIX}${i} is missing (the hit boxes render next to the model)`)
    return { bag, hit, bagRestY: bag.position.y, hitRestY: hit.position.y }
  })
  const surface = (root.getObjectByName('TeaSurface') as Mesh | undefined)?.material as MeshStandardMaterial | undefined
  if (!surface) throw new Error('TeaSurface is missing from the model (SPEC.md section 5)')
  return { bags, surface, target: new Color(), targetIndex: -1 }
}

/** Puts every bag at its rest height (before the rig is dropped). */
export function resetTeaRig(rig: TeaRig): void {
  for (const b of rig.bags) {
    b.bag.position.y = b.bagRestY
    b.hit.position.y = b.hitRestY
  }
}

/** Per frame: the active bag stands `bagLift` above its rest height, the others sit at rest; the tea surface colour follows the tea. */
export function tickTeaSelection(rig: TeaRig, teaIndex: number, delta: number): void {
  const dt = Math.min(delta, TEA_SELECT.maxDelta)
  if (rig.targetIndex !== teaIndex) {
    const tea = TEAS[teaIndex]
    if (!tea) throw new Error(`TEAS has no entry ${teaIndex}`)
    rig.target.set(tea.liquidColor)
    rig.targetIndex = teaIndex
  }
  const c = rig.surface.color
  const k = TEA_SELECT.teaDamping
  c.r = MathUtils.damp(c.r, rig.target.r, k, dt)
  c.g = MathUtils.damp(c.g, rig.target.g, k, dt)
  c.b = MathUtils.damp(c.b, rig.target.b, k, dt)
  for (let i = 0; i < rig.bags.length; i += 1) {
    const b = rig.bags[i]
    if (!b) continue
    const lift = i === teaIndex ? TEA_SELECT.bagLift : 0
    b.bag.position.y = MathUtils.damp(b.bag.position.y, b.bagRestY + lift, TEA_SELECT.bagDamping, dt)
    b.hit.position.y = b.hitRestY + (b.bag.position.y - b.bagRestY)
  }
}
