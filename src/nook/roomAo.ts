import { Mesh, MeshStandardMaterial, NoColorSpace, type Material, type Object3D, type Texture } from 'three'
import { AO_TEXTURE } from './contract.ts'
import { assetUrl } from '../lib/assetUrl.ts'

/** URL of the baked ambient-occlusion texture of `Room` (built from the Vite base path, never a leading slash). */
export const ROOM_AO_URL = assetUrl(`models/${AO_TEXTURE.file}`)

/** The UV set a texture reads from: glTF TEXCOORD_1 is three's `uv1`, which is texture channel 1. `UV_AO` is that set. */
const AO_UV_CHANNEL = 1

/** Materials that any mesh without a second UV set (`uv1`) uses: an aoMap on them would read texel (0, 0) for every pixel. */
function materialsWithoutAoUv(room: Object3D): Set<Material> {
  let root: Object3D = room
  while (root.parent) root = root.parent
  const skip = new Set<Material>()
  root.traverse((node) => {
    if (!(node instanceof Mesh) || node.geometry.getAttribute('uv1')) return
    for (const m of Array.isArray(node.material) ? node.material : [node.material]) skip.add(m)
  })
  return skip
}

/**
 * Every standard material that belongs to the `Room` node (one per child mesh of the exported group), except the ones that a mesh
 * without `uv1` also uses (phase 3: the `Mat_Bag0..3` jar materials are shared with the `TeaBag` meshes, which have no AO UVs).
 */
function roomMaterials(room: Object3D): MeshStandardMaterial[] {
  const skip = materialsWithoutAoUv(room)
  const found = new Set<MeshStandardMaterial>()
  room.traverse((node) => {
    const material = (node as { material?: Material | Material[] }).material
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      if (m instanceof MeshStandardMaterial && !skip.has(m)) found.add(m)
    }
  })
  return [...found]
}

/**
 * Makes a separately loaded PNG behave like the data the exporter wrote: read from `UV_AO` (channel 1), not flipped
 * (glTF textures use flipY = false, so a texture loaded outside GLTFLoader must match), no colour transform (AO is
 * data, not a colour). Call before the first render that uses the texture.
 */
export function configureAoTexture(texture: Texture): void {
  texture.channel = AO_UV_CHANNEL
  texture.flipY = false
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
}

/**
 * Applies the AO map to the `Room` materials. The materials belong to the useGLTF cache, so `detachRoomAo` must run
 * when the texture is disposed. Only `Room` gets AO: `Mug` and `Kettle` stay flat coloured (SPEC section 5).
 */
export function applyRoomAo(room: Object3D, texture: Texture, intensity: number): void {
  for (const m of roomMaterials(room)) {
    m.aoMap = texture
    m.aoMapIntensity = intensity
    m.needsUpdate = true // a new map changes the shader program
  }
}

export function detachRoomAo(room: Object3D): void {
  for (const m of roomMaterials(room)) {
    m.aoMap = null
    m.needsUpdate = true
  }
}

/** Sets the strength of the AO on the `Room` materials (0 = off, 1 = as baked). */
export function setRoomAoIntensity(room: Object3D, intensity: number): void {
  for (const m of roomMaterials(room)) m.aoMapIntensity = intensity
}

/** Current AO intensity of the first `Room` material (they all share one value), or null without materials. */
export function getRoomAoIntensity(room: Object3D): number | null {
  return roomMaterials(room)[0]?.aoMapIntensity ?? null
}
