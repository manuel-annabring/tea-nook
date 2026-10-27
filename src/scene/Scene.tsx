import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

// Slice 0 stand-in: proves the toolchain end to end. Replaced by the real scene in slice 1 and 2.
function SpinningCube() {
  const ref = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta
  })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#d9694a" />
    </mesh>
  )
}

export default function Scene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [2.5, 2, 3.5], fov: 35 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={2} />
      <SpinningCube />
      <OrbitControls enableDamping enablePan={false} />
    </Canvas>
  )
}
