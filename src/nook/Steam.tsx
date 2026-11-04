import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store/useStore.ts'
import { createSteamGeometry } from './steamGeometry.ts'
import type { SteamLook } from './steamDefaults.ts'
import { applyLook, createNoiseTexture, createSteamMaterial, tickSteam, type PointerTarget } from './steamMaterial.ts'

interface SteamProps {
  position?: [number, number, number]
  look: SteamLook
}

export function Steam({ position, look }: SteamProps) {
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
    const target = pointer.current
    target.x = s.pointerX
    target.y = s.pointerY
    target.z = s.pointerZ
    target.active = s.pointerActive
    tickSteam(material, delta, speed.current, target)
  })

  // frustumCulled is off: the shader displaces vertices beyond the geometry's bounding box.
  return <mesh name="Steam" position={position} geometry={geometry} material={material} frustumCulled={false} />
}
