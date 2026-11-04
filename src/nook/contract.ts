import type { Object3D } from 'three'

// Model contract from SPEC.md section 5. Keep in sync with tools/blender/contract_spec.py
// (contract.test.ts parses that file and fails if the two differ).
// Never change this without a SPEC.md amendment.

export interface ContractObject {
  readonly name: string
  readonly type: 'MESH' | 'EMPTY'
  readonly parent: string | null
}

/** Objects the code finds by name: name, Blender type, parent name. */
export const CONTRACT_OBJECTS = [
  { name: 'Room', type: 'MESH', parent: null },
  { name: 'Mug', type: 'MESH', parent: null },
  { name: 'TeaSurface', type: 'MESH', parent: 'Mug' },
  { name: 'Steam_Tea', type: 'EMPTY', parent: 'Mug' },
  { name: 'Kettle', type: 'MESH', parent: null },
  { name: 'Steam_Kettle', type: 'EMPTY', parent: 'Kettle' },
  { name: 'Window_Glass', type: 'MESH', parent: null },
  { name: 'Window_Sky', type: 'MESH', parent: null },
  { name: 'Rays_Origin', type: 'EMPTY', parent: null },
  { name: 'Rays_Target', type: 'EMPTY', parent: null },
  { name: 'Dust_Min', type: 'EMPTY', parent: null },
  { name: 'Dust_Max', type: 'EMPTY', parent: null },
  { name: 'Orbit_Target', type: 'EMPTY', parent: null },
] as const satisfies readonly ContractObject[]

export type NodeName = (typeof CONTRACT_OBJECTS)[number]['name']

export const REQUIRED_NODE_NAMES: readonly NodeName[] = CONTRACT_OBJECTS.map((o) => o.name)

/** Marker Empties: only their position carries meaning (read it from the marker, never hard-code). */
export const MARKER_NAMES: readonly NodeName[] = CONTRACT_OBJECTS.filter((o) => o.type === 'EMPTY').map(
  (o) => o.name,
)

/** Material names are fixed by the contract. */
export const MATERIAL_NAMES = [
  'Mat_Wall',
  'Mat_Wood',
  'Mat_Frame',
  'Mat_Leaf',
  'Mat_Pot',
  'Mat_Tin',
  'Mat_Book',
  'Mat_Mug',
  'Mat_Tea',
  'Mat_Kettle',
  'Mat_KettleDetail',
  'Mat_Glass',
  'Mat_Sky',
] as const

export type MaterialName = (typeof MATERIAL_NAMES)[number]

/** `Room` UV layers (SPEC.md section 5, AO amendment): the placeholder first, the baked-AO layout second (glTF TEXCOORD_1). */
export const ROOM_UV_LAYER = 'UVMap'
export const ROOM_UV_AO_LAYER = 'UV_AO'

/** Baked AO texture of `Room` (file in `public/models/`, size in pixels, square). */
export const AO_TEXTURE = {
  file: 'room_ao.png',
  size: 1024,
  maxSize: 2048,
} as const

/** Budgets (SPEC.md section 5). */
export const BUDGETS = {
  triangleTarget: 30000,
  triangleCap: 100000,
  glbMaxMb: 3,
  maxMaterials: 14,
  originToleranceMm: 1,
} as const

/** Fails loudly if the loaded model is missing a node the code relies on. */
export function assertContract(root: Object3D): void {
  const missing = REQUIRED_NODE_NAMES.filter((name) => !root.getObjectByName(name))
  if (missing.length > 0) {
    throw new Error(
      `nook.glb breaks the model contract (SPEC.md section 5). Missing nodes: ${missing.join(', ')}`,
    )
  }
}
