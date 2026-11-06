import type { Mesh, Object3D } from 'three'
import { SHADOW } from '../config/look.ts'
import { TEA_BAG_NAMES } from './contract.ts'

/**
 * Shadow flags for the one live sun shadow (slice 2.5). `Room`, `Mug` and `Kettle` cast and receive (a lit mug in the
 * wall's shadow would look wrong if it only cast). `TeaSurface` only receives, so the rim shades the tea. The window
 * glass and sky card never cast, and the steam is unlit and transparent, so it stays out entirely. The four tea bags
 * (slice D3) receive and cast only if `SHADOW.teaBagsCast` says so (default no, one draw call each in the shadow pass).
 * A bag missing from the model throws with its name (dev and production alike, like the markers in `Nook`).
 */
export function applyShadowFlags(root: Object3D): void {
  for (const name of ['Room', 'Mug', 'Kettle'] as const) {
    root.getObjectByName(name)?.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
  }
  for (const name of TEA_BAG_NAMES) {
    const bag = root.getObjectByName(name) as Mesh | undefined
    if (!bag) throw new Error(`${name} is missing from the model (SPEC.md section 5)`)
    bag.castShadow = SHADOW.teaBagsCast
    bag.receiveShadow = true
  }
  // TeaSurface is a child of Mug, so the loop above made it a caster too; it only receives.
  const tea = root.getObjectByName('TeaSurface') as Mesh | undefined
  if (tea) {
    tea.castShadow = false
    tea.receiveShadow = true
  }
}
