import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Box3, Vector3, type Mesh } from 'three'
import { TEA_SELECT } from '../config/look.ts'
import { assetUrl } from '../lib/assetUrl.ts'
import { TEA_BAG_NAMES } from '../nook/contract.ts'
import { TEA_BAG_HIT_PREFIX } from '../nook/teaSelection.ts'
import { useStore } from '../store/useStore.ts'
import { CLICK_MAX_DRAG_PX } from './clickThreshold.ts'
import { useHoverCursor } from './useHoverCursor.ts'

const MODEL_URL = assetUrl('models/nook.glb')

/**
 * One invisible, slightly larger box per tea bag (`TeaBagHit_i`), because a bag is only 10 to 17 px wide at the hero
 * view. `visible={false}` keeps it out of the render and shadow passes (no draw call) while the raycaster still tests
 * it. Size and rest position come from the bag nodes of the (cached) GLB; `tickTeaSelection` moves the box with the bag.
 */
export function TeaBagHits() {
  const { nodes } = useGLTF(MODEL_URL) as unknown as { nodes: Record<string, Mesh> }
  const cursor = useHoverCursor()
  const boxes = useMemo(() => {
    const box = new Box3()
    const size = new Vector3()
    const center = new Vector3()
    const pad = TEA_SELECT.hitPadding
    return TEA_BAG_NAMES.map((name) => {
      const bag = nodes[name]
      if (!bag) throw new Error(`${name} is missing from the model (SPEC.md section 5)`)
      bag.geometry.computeBoundingBox()
      if (!bag.geometry.boundingBox) throw new Error(`${name} has no geometry`)
      box.copy(bag.geometry.boundingBox)
      box.getSize(size)
      box.getCenter(center)
      return {
        size: [size.x + 2 * pad.x, size.y + 2 * pad.y, TEA_SELECT.hitDepth] as const,
        position: [bag.position.x + center.x, bag.position.y + center.y, bag.position.z + center.z] as const,
      }
    })
  }, [nodes])

  return (
    <>
      {boxes.map((b, i) => (
        <mesh
          key={TEA_BAG_NAMES[i]}
          name={`${TEA_BAG_HIT_PREFIX}${i}`}
          position={b.position}
          visible={false}
          userData={{ hitProxy: true }}
          onClick={(e) => {
            e.stopPropagation()
            if (e.delta > CLICK_MAX_DRAG_PX) return
            useStore.getState().setTea(i)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            cursor.over(e.object)
          }}
          onPointerOut={(e) => cursor.out(e.object)}
        >
          <boxGeometry args={b.size} />
          <meshBasicMaterial />
        </mesh>
      ))}
    </>
  )
}
