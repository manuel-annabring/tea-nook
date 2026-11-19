import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import type { Object3D } from 'three'
import { useStore } from '../store/useStore.ts'
import { CLICK_MAX_DRAG_PX } from './clickThreshold.ts'

function within(node: Object3D | null, name: string): boolean {
  for (let n = node; n; n = n.parent) if (n.name === name) return true
  return false
}

/**
 * Pointer handlers for the whole model group. Only hits inside `Mug` (the mug mesh, its tea surface) count; hits on
 * anything else are ignored without stopping them. Click advances the tea (the hover cursor is `useTeaHoverCursor`).
 * Handlers only call store actions (no state is owned here).
 */
export function useMugHandlers() {
  return useMemo(
    () => ({
      onClick: (e: ThreeEvent<MouseEvent>) => {
        if (!within(e.object, 'Mug')) return
        e.stopPropagation()
        if (e.delta > CLICK_MAX_DRAG_PX) return
        useStore.getState().nextTea()
      },
    }),
    [],
  )
}
