import { useThree } from '@react-three/fiber'
import { useControls } from 'leva'
import type { Mesh, Scene } from 'three'
import { RAYS } from '../config/look.ts'
import { applyRaysShape, type RaysMaterial, type RaysShape } from '../nook/raysMaterial.ts'

function findRays(scene: Scene): Mesh | undefined {
  return scene.getObjectByName('RaysMesh') as Mesh | undefined
}

/**
 * Dev-only: the Rays folder in the Leva panel, the shape shared by both times of day (the strength per time of day is in
 * the Light folder). Values are not persisted: copy good ones into `RAYS` in `look.ts`.
 */
export default function DevRays() {
  const scene = useThree((s) => s.scene)

  useControls('Rays', () => {
    const number = (key: keyof RaysShape, min: number, max: number, step: number) => ({
      value: RAYS[key],
      min,
      max,
      step,
      onChange: (value: number, _path: string, context: { initial: boolean }) => {
        if (context.initial) return
        const mesh = findRays(scene)
        if (mesh) applyRaysShape(mesh.material as RaysMaterial, { [key]: value })
      },
    })
    return {
      visible: {
        value: true,
        onChange: (value: boolean, _path: string, context: { initial: boolean }) => {
          const mesh = findRays(scene)
          if (!context.initial && mesh) mesh.visible = value
        },
      },
      crossSoftness: number('crossSoftness', 0.02, 0.5, 0.01),
      fadeIn: number('fadeIn', 0.005, 0.3, 0.005),
      endFade: number('endFade', 0.005, 0.3, 0.005),
      edgeMargin: number('edgeMargin', 0.001, 0.15, 0.001),
      reachStart: number('reachStart', 0.1, 0.8, 0.01),
      reachEnd: number('reachEnd', 0.85, 1.6, 0.01),
      noiseAcross: number('noiseAcross', 0.25, 8, 0.05),
      noiseSide: number('noiseSide', 0, 3, 0.05),
      noiseAlong: number('noiseAlong', 0, 3, 0.05),
      drift: number('drift', 0, 0.1, 0.001),
      cutLow: number('cutLow', 0, 0.5, 0.01),
      cutHigh: number('cutHigh', 0.51, 1, 0.01),
      base: number('base', 0, 1, 0.01),
      mullionDim: number('mullionDim', 0, 1, 0.01),
      mullionSoftness: number('mullionSoftness', 0.001, 0.05, 0.001),
    }
  }, [scene])

  return null
}
