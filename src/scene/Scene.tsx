import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense } from 'react'
import { MathUtils, Vector3 } from 'three'
import { BACKGROUND_COLOR, CAMERA, LIGHT_PRESETS } from '../config/look.ts'
import { PointerProbe } from '../input/PointerProbe.tsx'
import { Nook } from '../nook/Nook.tsx'
import { poseToPosition } from './framing.ts'

// Dev-only verification hooks and panel visibility (see CLAUDE.md Commands).
const DevHooks = import.meta.env.DEV ? lazy(() => import('../dev/DevHooks.tsx')) : null
const DevPanel = import.meta.env.DEV ? lazy(() => import('../dev/DevPanel.tsx')) : null
const DevSteam = import.meta.env.DEV ? lazy(() => import('../dev/DevSteam.tsx')) : null

const { morning } = LIGHT_PRESETS
const { limits } = CAMERA
const { degToRad } = MathUtils
// Contract names of the steam markers; the probe derives its plane heights from them.
const STEAM_MARKERS = { tea: 'Steam_Tea', kettle: 'Steam_Kettle' } as const
// Initial pose around the origin; `Nook` re-frames on the `Orbit_Target` marker once the model has loaded.
const initialPosition = poseToPosition(CAMERA.presets.hero, new Vector3(), new Vector3())

export default function Scene() {
  return (
    <>
      {DevPanel ? (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      ) : null}
      <Canvas dpr={[1, 2]} camera={{ position: initialPosition, fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far }}>
        <color attach="background" args={[BACKGROUND_COLOR]} />
        <hemisphereLight args={[morning.fillSkyColor, morning.fillGroundColor, morning.fillIntensity]} />
        <directionalLight color={morning.sunColor} intensity={morning.sunIntensity} position={[...morning.sunPosition]} />
        <Suspense fallback={null}>
          <Nook />
        </Suspense>
        <PointerProbe markers={STEAM_MARKERS} />
        {DevSteam ? (
          <Suspense fallback={null}>
            <DevSteam />
          </Suspense>
        ) : null}
        {DevHooks ? (
          <Suspense fallback={null}>
            <DevHooks />
          </Suspense>
        ) : null}
        <OrbitControls
          makeDefault
          enableDamping
          enablePan={false}
          minAzimuthAngle={degToRad(limits.azimuthMin)}
          maxAzimuthAngle={degToRad(limits.azimuthMax)}
          minPolarAngle={degToRad(limits.polarMin)}
          maxPolarAngle={degToRad(limits.polarMax)}
          minDistance={limits.distanceMin}
          maxDistance={limits.distanceMax}
        />
      </Canvas>
    </>
  )
}
