import { BufferAttribute, BufferGeometry } from 'three'

/**
 * All ray sheets in one geometry (one draw call). The attribute `position` is not a place in space but the coordinates
 * the vertex shader builds one from: x along the beam (0 to 1), y across its height (0 to 1), z across its width
 * (-1 to 1, one value per sheet, none in the middle for an even count: that is where the upright cross bar is).
 * `aWeight` is the sheet's share of the ray strength; the shares add up to 1, the outer ones are smaller by `sideDim`.
 * The caller disposes it.
 */
export function createRaysGeometry(planes: number, sideDim: number): BufferGeometry {
  const positions = new Float32Array(planes * 4 * 3)
  const weights = new Float32Array(planes * 4)
  const index: number[] = []
  const across = Array.from({ length: planes }, (_, k) => (2 * k + 1) / planes - 1)
  const share = across.map((z) => 1 - sideDim * z * z)
  const total = share.reduce((sum, w) => sum + w, 0)
  across.forEach((z, k) => {
    positions.set([0, 0, z, 1, 0, z, 1, 1, z, 0, 1, z], k * 12)
    weights.fill((share[k] as number) / total, k * 4, k * 4 + 4)
    const v = k * 4
    index.push(v, v + 1, v + 2, v, v + 2, v + 3)
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aWeight', new BufferAttribute(weights, 1))
  geometry.setIndex(index)
  return geometry
}
