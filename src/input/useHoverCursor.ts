import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { Mesh, Raycaster, Vector2, type Object3D } from 'three'
import { TEA_BAG_HIT_PREFIX } from '../nook/teaSelection.ts'

/** True for the mug (and its tea surface) and for the invisible tea bag hit boxes: the things a click acts on. */
export function isTeaTarget(node: Object3D | null): boolean {
  for (let n = node; n; n = n.parent) {
    if (n.name === 'Mug' || n.name.startsWith(TEA_BAG_HIT_PREFIX)) return true
  }
  return false
}

function isTransparent(mesh: Mesh): boolean {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return materials.some((m) => m.transparent)
}

/**
 * Pointer cursor while the pointer is over the mug or a tea bag. Own raycast on `pointermove` (at most one per frame)
 * instead of r3f's `onPointerOver/Out`: r3f keys its hover records by the event object and the triangle index, so
 * hits on different meshes of the one model group could collide and swallow the `over` event (the cursor then only
 * appeared after a click, phase 3 fix, D-136). The steam (raycast disabled) and transparent glass are skipped, like
 * `__nook.pick`. Resets the cursor when the pointer leaves and on unmount.
 */
export function useTeaHoverCursor(): void {
  const element = useThree((s) => s.gl.domElement)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    let pending = false
    let clientX = 0
    let clientY = 0
    let frame = 0

    const update = () => {
      pending = false
      const rect = element.getBoundingClientRect()
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      let over = false
      for (const hit of raycaster.intersectObject(scene, true)) {
        if (hit.object instanceof Mesh && isTransparent(hit.object) && !hit.object.name.startsWith(TEA_BAG_HIT_PREFIX)) continue
        over = isTeaTarget(hit.object)
        break
      }
      element.style.cursor = over ? 'pointer' : ''
    }
    const onMove = (e: PointerEvent) => {
      clientX = e.clientX
      clientY = e.clientY
      if (!pending) {
        pending = true
        frame = requestAnimationFrame(update)
      }
    }
    const onLeave = () => {
      cancelAnimationFrame(frame)
      pending = false
      element.style.cursor = ''
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', onLeave)
    return () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
      element.style.cursor = ''
    }
  }, [element, scene, camera])
}
