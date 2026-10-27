import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'
import { useStore } from '../store/useStore.ts'

/** Dev helper: a small sphere that follows the projected pointer, to verify the plumbing. */
export function PointerMarker() {
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const { pointerX, pointerY, pointerZ, pointerActive } = useStore.getState()
    mesh.visible = pointerActive
    mesh.position.set(pointerX, pointerY, pointerZ)
  })
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[0.006, 12, 12]} />
      <meshBasicMaterial color="#ef9f27" />
    </mesh>
  )
}
