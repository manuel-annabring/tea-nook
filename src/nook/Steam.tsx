import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import type { Mesh, Object3D } from 'three'
import { useStore, type SteamSlot } from '../store/useStore.ts'
import { createSteamGeometry } from './steamGeometry.ts'
import { applyLook, createNoiseTexture, createSteamMaterial, tickSteam, type PointerTarget } from './steamMaterial.ts'

interface SteamProps {
  slot: SteamSlot
  /** Model marker (`Steam_Tea`, `Steam_Kettle`) the steam base follows. The position is read from it, never hard-coded. */
  anchor: RefObject<Object3D | null>
}

/**
 * One steam column. The look comes from the store (`steamLooks[slot]`); the base follows the anchor marker's world
 * position. The mesh is named `SteamMesh_<slot>`, never a contract name.
 */
export function Steam({ slot, anchor }: SteamProps) {
  const look = useStore((s) => s.steamLooks[slot])
  const mesh = useRef<Mesh>(null)
  const noise = useMemo(() => createNoiseTexture(), [])
  const material = useMemo(() => createSteamMaterial(noise), [noise])
  const geometry = useMemo(() => createSteamGeometry(look.radius), [look.radius])
  const speed = useRef(look.speed)
  // Reused every frame so nothing is allocated in useFrame.
  const pointer = useRef<PointerTarget>({ x: 0, y: 0, z: 0, active: false })

  useEffect(() => () => noise.dispose(), [noise])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => geometry.dispose(), [geometry])

  useEffect(() => {
    speed.current = look.speed
    applyLook(material, look)
  }, [material, look])

  useFrame((_, delta) => {
    const s = useStore.getState()
    const p = s.pointers[slot]
    const target = pointer.current
    target.x = p.x
    target.y = p.y
    target.z = p.z
    target.active = s.pointerActive
    tickSteam(material, delta, speed.current, target)
    // The steam mesh lives at the scene root, so the marker's world position is also its local position.
    if (mesh.current && anchor.current) anchor.current.getWorldPosition(mesh.current.position)
  })

  // frustumCulled is off: the shader displaces vertices beyond the geometry's bounding box.
  return <mesh ref={mesh} name={`SteamMesh_${slot}`} geometry={geometry} material={material} frustumCulled={false} />
}
