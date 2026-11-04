import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense } from 'react'
import { PointerProbe } from '../input/PointerProbe.tsx'
import { Steam } from '../nook/Steam.tsx'
import { CAMERA, LIGHT_PRESETS, PALETTE, STEAM_LOOK_DEFAULTS } from '../config/look.ts'
import { MUG_HEIGHT, MUG_RADIUS, STEAM_HEIGHT } from './placeholder.ts'

// The Leva tweak panel is dev-only: the dynamic import is dropped from production builds.
const DevSteam = import.meta.env.DEV ? lazy(() => import('../dev/DevSteam.tsx')) : null
// Dev-only verification hooks and panel visibility (see CLAUDE.md Commands).
const DevHooks = import.meta.env.DEV ? lazy(() => import('../dev/DevHooks.tsx')) : null
const DevPanel = import.meta.env.DEV ? lazy(() => import('../dev/DevPanel.tsx')) : null

const { hero } = CAMERA.presets
const { morning } = LIGHT_PRESETS

// Placeholder: a cylinder "mug" on a counter patch. Replaced by the Blender model in slice 1.4.
function PlaceholderMug() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.45]} />
        <meshStandardMaterial color={PALETTE.Mat_Wood} />
      </mesh>
      <mesh name="Mug" position={[0, MUG_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[MUG_RADIUS, MUG_RADIUS * 0.9, MUG_HEIGHT, 32]} />
        <meshStandardMaterial color={PALETTE.Mat_Mug} />
      </mesh>
    </>
  )
}

export default function Scene() {
  return (
    <>
      {DevPanel ? (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      ) : null}
      <Canvas dpr={[1, 2]} camera={{ position: [...hero.position], fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far }}>
        <color attach="background" args={[PALETTE.Mat_Wall]} />
        <ambientLight intensity={morning.fillIntensity} />
        <directionalLight position={[...morning.sunPosition]} intensity={morning.sunIntensity} />
        <PlaceholderMug />
        <PointerProbe planeY={MUG_HEIGHT + STEAM_HEIGHT / 2} />
        {DevSteam ? (
          <Suspense fallback={null}>
            <DevSteam />
          </Suspense>
        ) : (
          <Steam position={[0, MUG_HEIGHT, 0]} look={STEAM_LOOK_DEFAULTS} />
        )}
        {DevHooks ? (
          <Suspense fallback={null}>
            <DevHooks />
          </Suspense>
        ) : null}
        <OrbitControls makeDefault enableDamping enablePan={false} target={[...hero.target]} />
      </Canvas>
    </>
  )
}
