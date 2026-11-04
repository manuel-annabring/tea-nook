import { create } from 'zustand'
import { KETTLE_STEAM_LOOK, STEAM_LOOK_DEFAULTS, type SteamLook } from '../config/look.ts'

/** The two steam columns. Both use the same material class with different looks. */
export type SteamSlot = 'tea' | 'kettle'

export interface PointerPoint {
  x: number
  y: number
  z: number
}

interface StoreState {
  /**
   * Pointer projected onto each steam's own horizontal plane, world meters. The two planes sit at different heights,
   * so the same mouse position lands at slightly different x/z on each. Read only in useFrame via getState().
   * The point objects are mutated in place (no allocation per mouse move).
   */
  pointers: Record<SteamSlot, PointerPoint>
  /** False while the pointer is outside the canvas or not hitting the steam planes. */
  pointerActive: boolean
  /** Current look per steam (dev panel overrides it; slice 3.1 will drive the tea steam from the selected tea). */
  steamLooks: Record<SteamSlot, SteamLook>
  setPointer: (slot: SteamSlot, x: number, y: number, z: number) => void
  setPointerActive: (active: boolean) => void
  setSteamLook: (slot: SteamSlot, look: SteamLook) => void
}

// Nothing subscribes to the pointer fields, so writing them on every move re-renders nothing.
export const useStore = create<StoreState>()((set, get) => ({
  pointers: { tea: { x: 0, y: 0, z: 0 }, kettle: { x: 0, y: 0, z: 0 } },
  pointerActive: false,
  steamLooks: { tea: STEAM_LOOK_DEFAULTS, kettle: KETTLE_STEAM_LOOK },
  setPointer: (slot, x, y, z) => {
    const p = get().pointers[slot]
    p.x = x
    p.y = y
    p.z = z
  },
  setPointerActive: (pointerActive) => {
    if (get().pointerActive !== pointerActive) set({ pointerActive })
  },
  setSteamLook: (slot, look) => set((s) => ({ steamLooks: { ...s.steamLooks, [slot]: look } })),
}))
