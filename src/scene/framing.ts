import { MathUtils, Spherical, Vector3, type Camera, type Object3D } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CameraPose } from '../config/look.ts'

// Scratch objects, module scope: these helpers run on demand (mount, dev hooks), not per frame.
const spherical = new Spherical()
const targetPos = new Vector3()

/** Writes the world position for a spherical pose around `target` into `out`. */
export function poseToPosition(pose: CameraPose, target: Vector3, out: Vector3): Vector3 {
  spherical.set(pose.distance, MathUtils.degToRad(pose.polar), MathUtils.degToRad(pose.azimuth))
  return out.setFromSpherical(spherical).add(target)
}

/** Points the orbit controls at the world position of `marker` and moves the camera to `pose` around it. */
export function frameCamera(camera: Camera, controls: OrbitControls, marker: Object3D, pose: CameraPose): void {
  marker.getWorldPosition(targetPos)
  controls.target.copy(targetPos)
  poseToPosition(pose, targetPos, camera.position)
  controls.update()
}
