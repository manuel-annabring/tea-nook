import type { Material, Object3D } from 'three'
import { MeshStandardMaterial } from 'three'
import { PALETTE, type MaterialName } from '../config/look.ts'

function isPaletteName(name: string): name is MaterialName {
  return name in PALETTE
}

/**
 * Sets the colour of every contract material in `root` from PALETTE, by material name (D-009).
 * Only the colour is touched, so `Mat_Glass` keeps the alpha it has in the model (D-021).
 * The materials belong to the useGLTF cache, so they are not disposed here.
 */
export function applyPalette(root: Object3D): void {
  root.traverse((node) => {
    const material = (node as { material?: Material | Material[] }).material
    const list = Array.isArray(material) ? material : material ? [material] : []
    for (const m of list) {
      if (m instanceof MeshStandardMaterial && isPaletteName(m.name)) m.color.set(PALETTE[m.name])
    }
  })
}

/**
 * Sets the colour of one contract material by name, on the shared (cached) material, so every mesh that uses it
 * follows. Used by the dev panel to try wall colours. Returns false when no material has that name.
 */
export function setPaletteColor(root: Object3D, name: MaterialName, color: string): boolean {
  let found = false
  root.traverse((node) => {
    const material = (node as { material?: Material | Material[] }).material
    const list = Array.isArray(material) ? material : material ? [material] : []
    for (const m of list) {
      if (m instanceof MeshStandardMaterial && m.name === name) {
        m.color.set(color)
        found = true
      }
    }
  })
  return found
}
