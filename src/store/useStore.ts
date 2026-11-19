import { create } from 'zustand'
import { KETTLE_STEAM_LOOK, STEAM_LOOK_DEFAULTS, TEAS, type SteamLook } from '../config/look.ts'

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
  /** Current look per steam (dev panel overrides it; the tea steam colour, density and speed follow the selected tea instead). */
  steamLooks: Record<SteamSlot, SteamLook>
  /** Index into `TEAS` of the selected tea. Read in useFrame via getState(); the damped visuals follow it. */
  teaIndex: number
  /** Next tea, wrapping from the last to the first. */
  nextTea: () => void
  /** Selects tea `index` (ignored when out of range). */
  setTea: (index: number) => void
  setPointer: (slot: SteamSlot, x: number, y: number, z: number) => void
  setPointerActive: (active: boolean) => void
  setSteamLook: (slot: SteamSlot, look: SteamLook) => void
  /** True once the model is mounted and two frames have rendered (production-safe; the loader overlay reads it). */
  sceneReady: boolean
  setSceneReady: () => void
}

// Nothing subscribes to the pointer fields, so writing them on every move re-renders nothing.
export const useStore = create<StoreState>()((set, get) => ({
  pointers: { tea: { x: 0, y: 0, z: 0 }, kettle: { x: 0, y: 0, z: 0 } },
  pointerActive: false,
  steamLooks: { tea: STEAM_LOOK_DEFAULTS, kettle: KETTLE_STEAM_LOOK },
  teaIndex: 0,
  nextTea: () => set((s) => ({ teaIndex: (s.teaIndex + 1) % TEAS.length })),
  setTea: (index) => {
    if (Number.isInteger(index) && index >= 0 && index < TEAS.length && index !== get().teaIndex) set({ teaIndex: index })
  },
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
  sceneReady: false,
  setSceneReady: () => set({ sceneReady: true }),
}))
