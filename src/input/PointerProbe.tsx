import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Plane, Raycaster, Vector2, Vector3, type Object3D } from 'three'
import { useStore, type SteamSlot } from '../store/useStore.ts'

interface PointerProbeProps {
  /** Contract name of each steam's marker. Its world height plus half the steam height gives that steam's pointer plane. */
  markers: Record<SteamSlot, string>
}

const SLOTS: readonly SteamSlot[] = ['tea', 'kettle']

/**
 * Projects the mouse onto one horizontal plane per steam (ray-plane intersection, plane at the middle of that steam's
 * column) and writes the hits to the store as plain numbers. Each steam gets its own plane because the kettle steam is
 * taller and stands elsewhere than the mug steam: one shared height would shift the hit in x/z for one of them.
 * It listens on the canvas element instead of using a mesh, so it never blocks other pointer events.
 */
export function PointerProbe({ markers }: PointerProbeProps) {
  const domElement = useThree((s) => s.gl.domElement)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const scratch = useRef({
    raycaster: new Raycaster(),
    ndc: new Vector2(),
    hit: new Vector3(),
    base: new Vector3(),
    plane: new Plane(new Vector3(0, 1, 0), 0),
  })

  useEffect(() => {
    const { raycaster, ndc, hit, base, plane } = scratch.current
    const { setPointer, setPointerActive } = useStore.getState()
    // Markers are looked up on the first move (the model loads asynchronously) and then kept.
    const found: Partial<Record<SteamSlot, Object3D>> = {}

    const onMove = (e: PointerEvent) => {
      const rect = domElement.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      let hitAll = true
      for (const slot of SLOTS) {
        const marker = (found[slot] ??= scene.getObjectByName(markers[slot]))
        if (!marker) {
          hitAll = false
          continue
        }
        const height = useStore.getState().steamLooks[slot].height
        marker.getWorldPosition(base)
        plane.constant = -(base.y + height / 2)
        if (raycaster.ray.intersectPlane(plane, hit)) setPointer(slot, hit.x, hit.y, hit.z)
        else hitAll = false
      }
      setPointerActive(hitAll)
    }
    const onLeave = () => setPointerActive(false)

    domElement.addEventListener('pointermove', onMove)
    domElement.addEventListener('pointerleave', onLeave)
    return () => {
      domElement.removeEventListener('pointermove', onMove)
      domElement.removeEventListener('pointerleave', onLeave)
      setPointerActive(false)
    }
  }, [domElement, camera, scene, markers])

  return null
}
