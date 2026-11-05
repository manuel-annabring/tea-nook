export type Point3 = readonly [number, number, number]

/** An orthographic shadow camera volume: `left`..`top` in meters in the light's own axes, `near` and `far` in meters along its view direction. */
export interface ShadowFrustum {
  left: number
  right: number
  bottom: number
  top: number
  near: number
  far: number
}

/** Smallest `near` the fit returns (three's shadow camera needs a positive value). */
const MIN_NEAR = 0.01

function sub(a: Point3, b: Point3): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross(a: Point3, b: Point3): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot(a: Point3, b: Point3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function normalize(a: Point3): [number, number, number] {
  const length = Math.hypot(a[0], a[1], a[2])
  return [a[0] / length, a[1] / length, a[2] / length]
}

/** The 8 corners of an axis-aligned box. */
export function boxCorners(min: Point3, max: Point3): Point3[] {
  const corners: Point3[] = []
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push([x, y, z])
  return corners
}

/**
 * Fits the orthographic shadow camera of a directional light to a set of points (the corners of the diorama's bounding
 * box), so no caster or receiver is clipped and no shadow-map texels are wasted. The camera sits at `sunPosition` and
 * looks at `target` with three's default up vector (+Y), exactly like `DirectionalLightShadow`. Each point is
 * projected into the light's view space (right, up, forward); the result is the tight box around them plus `margin`
 * meters on every side (room for the PCF blur and the normal bias). `near` and `far` are distances from the light
 * along its view direction. Does not work for a light straight above the target (view direction parallel to +Y), where
 * three picks the camera roll arbitrarily: keep the sun below about 89 degrees elevation.
 */
export function fitShadowFrustum(sunPosition: Point3, points: readonly Point3[], margin: number, target: Point3 = [0, 0, 0]): ShadowFrustum {
  const forward = normalize(sub(target, sunPosition))
  const right = normalize(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  let left = Infinity
  let rightEdge = -Infinity
  let bottom = Infinity
  let top = -Infinity
  let near = Infinity
  let far = -Infinity
  for (const point of points) {
    const d = sub(point, sunPosition)
    const x = dot(d, right)
    const y = dot(d, up)
    const depth = dot(d, forward)
    left = Math.min(left, x)
    rightEdge = Math.max(rightEdge, x)
    bottom = Math.min(bottom, y)
    top = Math.max(top, y)
    near = Math.min(near, depth)
    far = Math.max(far, depth)
  }
  return {
    left: left - margin,
    right: rightEdge + margin,
    bottom: bottom - margin,
    top: top + margin,
    near: Math.max(MIN_NEAR, near - margin),
    far: far + margin,
  }
}
