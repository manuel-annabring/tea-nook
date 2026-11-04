import type { Mesh, Object3D } from 'three'

/**
 * Shadow flags for the one live sun shadow (slice 2.5). `Room`, `Mug` and `Kettle` cast and receive (a lit mug in the
 * wall's shadow would look wrong if it only cast). `TeaSurface` only receives, so the rim shades the tea. The window
 * glass and sky card never cast, and the steam is unlit and transparent, so it stays out entirely.
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
  const tea = root.getObjectByName('TeaSurface') as Mesh | undefined
  if (tea) tea.receiveShadow = true
}
