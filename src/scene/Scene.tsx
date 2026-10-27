import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense } from 'react'
import { PointerProbe } from '../input/PointerProbe.tsx'
import { Steam } from '../nook/Steam.tsx'
import { STEAM_LOOK_DEFAULTS } from '../nook/steamDefaults.ts'
import { MUG_HEIGHT, MUG_RADIUS, STEAM_HEIGHT } from './placeholder.ts'

// The Leva tweak panel is dev-only: the dynamic import is dropped from production builds.
const DevSteam = import.meta.env.DEV ? lazy(() => import('../dev/DevSteam.tsx')) : null

// Slice 1 placeholder: a cylinder "mug" on a counter patch. Replaced by the Blender model in slice 3.
function PlaceholderMug() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.45]} />
        <meshStandardMaterial color="#c98f5b" />
      </mesh>
      <mesh position={[0, MUG_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[MUG_RADIUS, MUG_RADIUS * 0.9, MUG_HEIGHT, 32]} />
        <meshStandardMaterial color="#d9694a" />
      </mesh>
    </>
  )
}

export default function Scene() {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0.4, 0.28, 0.6], fov: 35, near: 0.01, far: 20 }}>
      <color attach="background" args={['#f2e6d0']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[0.6, 1, 0.5]} intensity={2} />
      <PlaceholderMug />
      <PointerProbe planeY={MUG_HEIGHT + STEAM_HEIGHT / 2} />
      {DevSteam ? (
        <Suspense fallback={null}>
          <DevSteam />
        </Suspense>
      ) : (
        <Steam position={[0, MUG_HEIGHT, 0]} look={STEAM_LOOK_DEFAULTS} />
      )}
      <OrbitControls enableDamping enablePan={false} target={[0, MUG_HEIGHT + STEAM_HEIGHT / 3, 0]} />
    </Canvas>
  )
}
