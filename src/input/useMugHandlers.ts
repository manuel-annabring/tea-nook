import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import type { Object3D } from 'three'
import { useStore } from '../store/useStore.ts'
import { CLICK_MAX_DRAG_PX } from './clickThreshold.ts'
import { useHoverCursor } from './useHoverCursor.ts'

function within(node: Object3D | null, name: string): boolean {
  for (let n = node; n; n = n.parent) if (n.name === name) return true
  return false
}

/**
 * Pointer handlers for the whole model group. Only hits inside `Mug` (the mug mesh, its tea surface) count; hits on
 * anything else are ignored without stopping them. Click advances the tea, hover shows the pointer cursor.
 * Handlers only call store actions (no state is owned here).
 */
export function useMugHandlers() {
  const cursor = useHoverCursor()
  return useMemo(
    () => ({
      onClick: (e: ThreeEvent<MouseEvent>) => {
        if (!within(e.object, 'Mug')) return
        e.stopPropagation()
        if (e.delta > CLICK_MAX_DRAG_PX) return
        useStore.getState().nextTea()
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        if (!within(e.object, 'Mug')) return
        e.stopPropagation()
        cursor.over(e.object)
      },
      onPointerOut: (e: ThreeEvent<PointerEvent>) => {
        if (!within(e.object, 'Mug')) return
        cursor.out(e.object)
      },
    }),
    [cursor],
  )
}
