import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense } from 'react'
import { ACESFilmicToneMapping, MathUtils, NeutralToneMapping, NoToneMapping, PCFShadowMap, Vector3 } from 'three'
import { BACKGROUND_COLOR, CAMERA, TONE } from '../config/look.ts'
import { PointerProbe } from '../input/PointerProbe.tsx'
import { Nook } from '../nook/Nook.tsx'
import { poseToPosition } from './framing.ts'
import { Lights } from './Lights.tsx'
import { getShadowMode } from './shadowMode.ts'

// Dev-only verification hooks and panel visibility (see CLAUDE.md Commands).
const DevHooks = import.meta.env.DEV ? lazy(() => import('../dev/DevHooks.tsx')) : null
const DevPanel = import.meta.env.DEV ? lazy(() => import('../dev/DevPanel.tsx')) : null
const DevSteam = import.meta.env.DEV ? lazy(() => import('../dev/DevSteam.tsx')) : null

const { limits } = CAMERA
const { degToRad } = MathUtils
const TONE_MAPPINGS = { neutral: NeutralToneMapping, aces: ACESFilmicToneMapping, none: NoToneMapping } as const
const glProps = { toneMapping: TONE_MAPPINGS[TONE.mapping], toneMappingExposure: TONE.exposure }
// three r186 removed PCFSoftShadowMap: PCFShadowMap is the soft one (hardware PCF plus a blur radius on the light).
const shadows = getShadowMode() === 'off' ? false : { type: PCFShadowMap }
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
      <Canvas dpr={[1, 2]} shadows={shadows} gl={glProps} camera={{ position: initialPosition, fov: CAMERA.fov, near: CAMERA.near, far: CAMERA.far }}>
        <color attach="background" args={[BACKGROUND_COLOR]} />
        <Lights />
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
