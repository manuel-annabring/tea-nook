import { create } from 'zustand'

interface StoreState {
  /** Pointer projected onto the steam plane, world meters. Read only in useFrame via getState(). */
  pointerX: number
  pointerY: number
  pointerZ: number
  /** False while the pointer is outside the canvas or not hitting the steam plane. */
  pointerActive: boolean
  setPointer: (x: number, y: number, z: number) => void
  setPointerActive: (active: boolean) => void
}

// Nothing subscribes to the pointer fields, so writing them on every move re-renders nothing.
export const useStore = create<StoreState>()((set) => ({
  pointerX: 0,
  pointerY: 0,
  pointerZ: 0,
  pointerActive: false,
  setPointer: (pointerX, pointerY, pointerZ) => set({ pointerX, pointerY, pointerZ, pointerActive: true }),
  setPointerActive: (pointerActive) => set({ pointerActive }),
}))
