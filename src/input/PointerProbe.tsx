import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import { useStore } from '../store/useStore.ts'

interface PointerProbeProps {
  /** World height of the horizontal plane the pointer is projected onto (steam height). */
  planeY: number
}

/**
 * Projects the mouse onto a horizontal plane (ray-plane intersection) and writes the hit to
 * the store as plain numbers. It listens on the canvas element instead of using a mesh, so it
 * never blocks other pointer events and works wherever the pointer is.
 */
export function PointerProbe({ planeY }: PointerProbeProps) {
  const domElement = useThree((s) => s.gl.domElement)
  const camera = useThree((s) => s.camera)
  const scratch = useRef({
    raycaster: new Raycaster(),
    ndc: new Vector2(),
    hit: new Vector3(),
    plane: new Plane(new Vector3(0, 1, 0), 0),
  })

  useEffect(() => {
    const { raycaster, ndc, hit, plane } = scratch.current
    plane.constant = -planeY
    const { setPointer, setPointerActive } = useStore.getState()

    const onMove = (e: PointerEvent) => {
      const rect = domElement.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(plane, hit)) setPointer(hit.x, hit.y, hit.z)
      else setPointerActive(false)
    }
    const onLeave = () => setPointerActive(false)

    domElement.addEventListener('pointermove', onMove)
    domElement.addEventListener('pointerleave', onLeave)
    return () => {
      domElement.removeEventListener('pointermove', onMove)
      domElement.removeEventListener('pointerleave', onLeave)
      setPointerActive(false)
    }
  }, [domElement, camera, planeY])

  return null
}
