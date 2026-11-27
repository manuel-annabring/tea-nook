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

const ORIGIN: Point3 = [0, 0, 0]

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
 *
 * The result is written into `out`. With a reused `out` the function allocates nothing, so it can run every frame while
 * the sun moves (time-of-day transition); that is why the vector maths is written out in scalars.
 */
export function fitShadowFrustum(
  sunPosition: Point3,
  points: readonly Point3[],
  margin: number,
  target: Point3 = ORIGIN,
  out: ShadowFrustum = { left: 0, right: 0, bottom: 0, top: 0, near: 0, far: 0 },
): ShadowFrustum {
  // forward = normalize(target - sun)
  let fx = target[0] - sunPosition[0]
  let fy = target[1] - sunPosition[1]
  let fz = target[2] - sunPosition[2]
  const fl = Math.hypot(fx, fy, fz)
  fx /= fl
  fy /= fl
  fz /= fl
  // right = normalize(forward x (0, 1, 0)) = normalize(-fz, 0, fx)
  const rl = Math.hypot(fz, fx)
  const rx = -fz / rl
  const rz = fx / rl
  // up = right x forward (right has no y component)
  const ux = -rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy
  let left = Infinity
  let right = -Infinity
  let bottom = Infinity
  let top = -Infinity
  let near = Infinity
  let far = -Infinity
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i] as Point3
    const dx = point[0] - sunPosition[0]
    const dy = point[1] - sunPosition[1]
    const dz = point[2] - sunPosition[2]
    const x = dx * rx + dz * rz
    const y = dx * ux + dy * uy + dz * uz
    const depth = dx * fx + dy * fy + dz * fz
    left = Math.min(left, x)
    right = Math.max(right, x)
    bottom = Math.min(bottom, y)
    top = Math.max(top, y)
    near = Math.min(near, depth)
    far = Math.max(far, depth)
  }
  out.left = left - margin
  out.right = right + margin
  out.bottom = bottom - margin
  out.top = top + margin
  out.near = Math.max(MIN_NEAR, near - margin)
  out.far = far + margin
  return out
}
