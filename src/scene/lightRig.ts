import { Box3, type DirectionalLight, type HemisphereLight, type Object3D } from 'three'
import { SHADOW } from '../config/look.ts'
import { boxCorners, fitShadowFrustum, type Point3 } from '../lib/shadowFit.ts'
import { sunPositionFromAngles } from '../lib/sunAngles.ts'

/** Contract names of the lights in the scene, so dev tools and hooks can find them. */
export const LIGHT_NAMES = { sun: 'Sun', hemisphere: 'HemiFill', front: 'FrontFill' } as const

/** Contract names of everything that casts or receives the sun shadow (see `applyShadowFlags`). */
const SHADOW_OBJECTS = ['Room', 'Mug', 'Kettle'] as const

const bounds = new Box3()
const partBounds = new Box3()
let haveBounds = false

/**
 * Measures the world-space bounding box of the shadow casters and receivers in `scene` and keeps it for `fitSunShadow`.
 * Returns false while one of them is not in the scene yet (the model is still loading). The box comes from the
 * model's geometry, nothing is hard-coded.
 */
export function measureShadowBounds(scene: Object3D): boolean {
  bounds.makeEmpty()
  for (const name of SHADOW_OBJECTS) {
    const part = scene.getObjectByName(name)
    if (!part) return false
    part.updateWorldMatrix(true, true)
    bounds.union(partBounds.setFromObject(part))
  }
  haveBounds = !bounds.isEmpty()
  return haveBounds
}

/**
 * Refits the sun's shadow camera to the measured bounds for the sun's current position. Does nothing until
 * `measureShadowBounds` has succeeded. Runs when the sun moves (mount, dev panel), not per frame. Also asks a frozen
 * (`static`) shadow map to render once more.
 */
export function fitSunShadow(sun: DirectionalLight): void {
  if (!haveBounds) return
  const position: Point3 = [sun.position.x, sun.position.y, sun.position.z]
  const frustum = fitShadowFrustum(position, boxCorners([bounds.min.x, bounds.min.y, bounds.min.z], [bounds.max.x, bounds.max.y, bounds.max.z]), SHADOW.margin)
  const camera = sun.shadow.camera
  camera.left = frustum.left
  camera.right = frustum.right
  camera.bottom = frustum.bottom
  camera.top = frustum.top
  camera.near = frustum.near
  camera.far = frustum.far
  camera.updateProjectionMatrix()
  sun.shadow.needsUpdate = true
}

/** Live light values for `applyLightLook` (what the dev panel edits). Angles in degrees, see `SunAngles`. */
export interface LightLook {
  sunAzimuth: number
  sunElevation: number
  sunIntensity: number
  sunColor: string
  hemisphereIntensity: number
  frontIntensity: number
  frontColor: string
}

/**
 * Writes `look` into the named lights of `scene` and refits the sun's shadow. The sun keeps its distance from the
 * origin, only its direction changes. A plain function (not component code) so it can mutate the lights; it is for
 * changes on demand (dev panel, time-of-day switch), not per frame.
 */
export function applyLightLook(scene: Object3D, look: LightLook): void {
  const sun = scene.getObjectByName(LIGHT_NAMES.sun) as DirectionalLight | undefined
  const hemisphere = scene.getObjectByName(LIGHT_NAMES.hemisphere) as HemisphereLight | undefined
  const front = scene.getObjectByName(LIGHT_NAMES.front) as DirectionalLight | undefined
  if (sun) {
    const [x, y, z] = sunPositionFromAngles({ azimuth: look.sunAzimuth, elevation: look.sunElevation }, sun.position.length())
    sun.position.set(x, y, z)
    sun.intensity = look.sunIntensity
    sun.color.set(look.sunColor)
    fitSunShadow(sun)
  }
  if (hemisphere) hemisphere.intensity = look.hemisphereIntensity
  if (front) {
    front.intensity = look.frontIntensity
    front.color.set(look.frontColor)
  }
}
