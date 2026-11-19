import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'

export interface HoverCursor {
  over: (target: object) => void
  out: (target: object) => void
  /** Clears every hover and the cursor. */
  reset: () => void
}

/**
 * Pointer cursor on the element while any registered target is hovered. A set instead of a flag, because r3f can fire
 * `over` for the next mesh of the same object before `out` for the previous one (mug and tea surface).
 */
export function createHoverCursor(element: HTMLElement): HoverCursor {
  const hovered = new Set<object>()
  const apply = () => {
    element.style.cursor = hovered.size > 0 ? 'pointer' : ''
  }
  return {
    over: (target) => {
      hovered.add(target)
      apply()
    },
    out: (target) => {
      hovered.delete(target)
      apply()
    },
    reset: () => {
      hovered.clear()
      apply()
    },
  }
}

/** One cursor handler per canvas; reset on unmount. */
export function useHoverCursor(): HoverCursor {
  const element = useThree((s) => s.gl.domElement)
  const cursor = useMemo(() => createHoverCursor(element), [element])
  useEffect(() => cursor.reset, [cursor])
  return cursor
}
