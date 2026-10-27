import { PlaneGeometry } from 'three'

const HEIGHT_SEGMENTS = 48
// Width needs real segments too: the pointer push and the twist move vertices, so a plane with
// only left and right edge vertices would just stretch instead of bending around the pointer.
const WIDTH_SEGMENTS = 16

/**
 * Steam is one flat plane that the vertex shader turns to face the camera around the Y axis
 * (a cylindrical billboard). It won the slice 1 comparison against an open tube and crossed
 * planes: no thin edge-on views, and the twist stays visible from every angle.
 * The plane is 1 unit tall (y from 0 to 1); the shader scales y to the real height.
 * `halfWidth` is half the plane width, meters.
 */
export function createSteamGeometry(halfWidth: number): PlaneGeometry {
  return new PlaneGeometry(halfWidth * 2, 1, WIDTH_SEGMENTS, HEIGHT_SEGMENTS).translate(0, 0.5, 0)
}
