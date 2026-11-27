import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { Mesh, Object3D } from 'three'
import { Color } from 'three'
import { TEAS } from '../config/look.ts'
import { timeLive } from '../scene/timeOfDayLive.ts'
import { useStore, type SteamSlot } from '../store/useStore.ts'
import { createSteamGeometry } from './steamGeometry.ts'
import {
  applyLook,
  applySteamTint,
  createNoiseTexture,
  createSteamMaterial,
  dampAppearance,
  tickSteam,
  type AppearanceState,
  type AppearanceTarget,
  type PointerTarget,
} from './steamMaterial.ts'

interface SteamProps {
  slot: SteamSlot
  /** Model marker (`Steam_Tea`, `Steam_Kettle`) the steam base follows. The position is read from it, never hard-coded. */
  anchor: RefObject<Object3D | null>
}

/** What the tea steam is heading for, plus the colour string it was parsed from. */
type TeaTarget = AppearanceTarget & { hex: string }

/**
 * Follows the selected tea. Compares values, not just the selection, so an edit of the selected tea in the dev panel
 * arrives too; the colour string is only parsed when it changes (nothing is allocated otherwise).
 */
function setTeaTarget(target: TeaTarget, index: number): void {
  const tea = TEAS[index]
  if (!tea) throw new Error(`TEAS has no entry ${index}`)
  if (target.hex !== tea.steamColor) {
    target.hex = tea.steamColor
    target.color.set(tea.steamColor)
  }
  target.density = tea.density
  target.speed = tea.speed
}

/**
 * One steam column. The look comes from the store (`steamLooks[slot]`); the base follows the anchor marker's world
 * position. The mesh is named `SteamMesh_<slot>`, never a contract name.
 */
/** The steam is not clickable: its transparent planes sit in front of the mug and would otherwise be hit first, which broke the mug hover (phase 3 fix). */
const noRaycast = () => null

export function Steam({ slot, anchor }: SteamProps) {
  const look = useStore((s) => s.steamLooks[slot])
  const mesh = useRef<Mesh>(null)
  // Noise parameters come from the look and are not live-tweakable, so the texture is built once per distinct block.
  const noiseParams = useStore.getState().steamLooks[slot].noise
  const noise = useMemo(() => createNoiseTexture(noiseParams), [noiseParams])
  const material = useMemo(() => createSteamMaterial(noise), [noise])
  const geometry = useMemo(() => createSteamGeometry(look.radius), [look.radius])
  // Rise speed (damped for the tea steam, copied from the look for the kettle).
  const appearance = useRef<AppearanceState>({ speed: look.speed, ready: slot !== 'tea' })
  const teaTarget = useRef<TeaTarget>({ color: new Color(), density: 0, speed: 0, hex: '' })
  // Reused every frame so nothing is allocated in useFrame.
  const pointer = useRef<PointerTarget>({ x: 0, y: 0, z: 0, active: false })

  useEffect(() => () => noise.dispose(), [noise])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => geometry.dispose(), [geometry])

  useEffect(() => {
    if (slot !== 'tea') appearance.current.speed = look.speed
    applyLook(material, look, slot !== 'tea')
  }, [slot, material, look])

  useFrame((_, delta) => {
    const s = useStore.getState()
    const p = s.pointers[slot]
    const target = pointer.current
    target.x = p.x
    target.y = p.y
    target.z = p.z
    target.active = s.pointerActive
    if (slot === 'tea') {
      // The tea steam follows the selected tea.
      const t = teaTarget.current
      setTeaTarget(t, s.teaIndex)
      dampAppearance(material, appearance.current, t, delta)
    }
    applySteamTint(material, timeLive.values.steamTint, timeLive.values.steamOpacity)
    tickSteam(material, delta, appearance.current.speed, target)
    // The steam mesh lives at the scene root, so the marker's world position is also its local position.
    if (mesh.current && anchor.current) anchor.current.getWorldPosition(mesh.current.position)
  })

  // frustumCulled is off: the shader displaces vertices beyond the geometry's bounding box.
  return <mesh ref={mesh} name={`SteamMesh_${slot}`} geometry={geometry} material={material} frustumCulled={false} raycast={noRaycast} />
}
