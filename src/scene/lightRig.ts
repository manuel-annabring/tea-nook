import { Box3, Color, SRGBColorSpace, Vector3, type DirectionalLight, type HemisphereLight, type Object3D, type PointLight, type Scene } from 'three'
import { SHADOW } from '../config/look.ts'
import { boxCorners, fitShadowFrustum, type Point3, type ShadowFrustum } from '../lib/shadowFit.ts'
import type { TimeValues } from '../lib/timeOfDay.ts'

/** Contract names of the lights in the scene, so dev tools and hooks can find them. */
export const LIGHT_NAMES = { sun: 'Sun', hemisphere: 'HemiFill', front: 'FrontFill', lamp: 'LampLight' } as const

/** Contract names of everything that casts or receives the sun shadow (see `applyShadowFlags`). */
const SHADOW_OBJECTS = ['Room', 'Mug', 'Kettle'] as const

const bounds = new Box3()
const partBounds = new Box3()
/** Corners of `bounds`; empty until the model has been measured. */
let corners: Point3[] = []

// Reused by every refit: the sun moves every frame during a time-of-day transition.
const sunPoint: [number, number, number] = [0, 0, 0]
const origin: Point3 = [0, 0, 0]
const frustum: ShadowFrustum = { left: 0, right: 0, bottom: 0, top: 0, near: 0, far: 0 }

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
  if (bounds.isEmpty()) return false
  corners = boxCorners([bounds.min.x, bounds.min.y, bounds.min.z], [bounds.max.x, bounds.max.y, bounds.max.z])
  return true
}

/**
 * Refits the sun's shadow camera to the measured bounds for the sun's current position, without allocating. Does
 * nothing until `measureShadowBounds` has succeeded. Runs when the sun moves (mount, time-of-day transition, dev
 * panel). Also asks a frozen (`static`) shadow map to render once more.
 */
export function fitSunShadow(sun: DirectionalLight): void {
  if (corners.length === 0) return
  sunPoint[0] = sun.position.x
  sunPoint[1] = sun.position.y
  sunPoint[2] = sun.position.z
  fitShadowFrustum(sunPoint, corners, SHADOW.margin, origin, frustum)
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

/** The scene objects the time of day writes to. */
export interface TimeSceneRig {
  sun: DirectionalLight
  hemisphere: HemisphereLight
  front: DirectionalLight
  lamp: PointLight
  background: Color
  /** Sun position of the last shadow fit. */
  fittedSun: Vector3
}

/** Finds the lights of `Lights` and the background colour. Throws with the missing name. */
export function createTimeSceneRig(scene: Scene): TimeSceneRig {
  const light = <T extends Object3D>(name: string): T => {
    const found = scene.getObjectByName(name)
    if (!found) throw new Error(`Light ${name} is missing from the scene (mount TimeOfDay after Lights)`)
    return found as T
  }
  if (!(scene.background instanceof Color)) throw new Error('The scene background must be a Color')
  return {
    sun: light<DirectionalLight>(LIGHT_NAMES.sun),
    hemisphere: light<HemisphereLight>(LIGHT_NAMES.hemisphere),
    front: light<DirectionalLight>(LIGHT_NAMES.front),
    lamp: light<PointLight>(LIGHT_NAMES.lamp),
    background: scene.background,
    fittedSun: new Vector3(Infinity, Infinity, Infinity),
  }
}

/**
 * Copies the live time values into the lights and the canvas background (per frame, allocation free). The shadow is
 * refitted only when the sun has moved, so a resting scene costs nothing and a `static` shadow map stays frozen.
 * The lamp light is never hidden or removed (the number of lights is compiled into every shader program).
 */
export function applyTimeToScene(rig: TimeSceneRig, v: TimeValues): void {
  const { sun, hemisphere, front, lamp } = rig
  sun.position.copy(v.sunPosition)
  sun.color.copy(v.sunColor)
  sun.intensity = v.sunIntensity
  hemisphere.color.copy(v.fillSkyColor)
  hemisphere.groundColor.copy(v.fillGroundColor)
  hemisphere.intensity = v.fillIntensity
  front.position.copy(v.frontFillPosition)
  front.color.copy(v.frontFillColor)
  front.intensity = v.frontFillIntensity
  lamp.color.copy(v.lampColor)
  lamp.intensity = v.lampIntensity
  const bg = v.pageBackground
  rig.background.setRGB(bg.x, bg.y, bg.z, SRGBColorSpace)
  if (!rig.fittedSun.equals(sun.position)) {
    fitSunShadow(sun)
    rig.fittedSun.copy(sun.position)
  }
}
