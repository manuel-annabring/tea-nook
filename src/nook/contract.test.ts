import { describe, expect, it } from 'vitest'
import specSource from '../../tools/blender/contract_spec.py?raw'
import {
  AO_TEXTURE,
  BUDGETS,
  CONTRACT_OBJECTS,
  MARKER_NAMES,
  MATERIAL_NAMES,
  REQUIRED_NODE_NAMES,
  TEA_BAG_NAMES,
  ROOM_UV_AO_LAYER,
  ROOM_UV_LAYER,
} from './contract.ts'

// contract_spec.py is the Blender-side copy of the contract. These tests parse it as text
// (no Python needed) so the two copies cannot drift apart silently.

/** Text between `NAME = [` and the closing `]` at the start of a line. */
function listBlock(name: string): string {
  const match = new RegExp(`^${name} = \\[\\n([\\s\\S]*?)^\\]`, 'm').exec(specSource)
  if (!match?.[1]) throw new Error(`contract_spec.py: list ${name} not found`)
  return match[1]
}

function pyNumber(name: string): number {
  const match = new RegExp(`^${name} = ([\\d_]+)\\s*$`, 'm').exec(specSource)
  if (!match?.[1]) throw new Error(`contract_spec.py: number ${name} not found`)
  return Number(match[1].replaceAll('_', ''))
}

function pyString(name: string): string {
  const match = new RegExp(`^${name} = "([^"]+)"\\s*$`, 'm').exec(specSource)
  if (!match?.[1]) throw new Error(`contract_spec.py: string ${name} not found`)
  return match[1]
}

const pyObjects = [...listBlock('OBJECTS').matchAll(/\("(\w+)", "(MESH|EMPTY)", (?:"(\w+)"|None)\)/g)].map((m) => ({
  name: m[1],
  type: m[2],
  parent: m[3] ?? null,
}))
const pyMaterials = [...listBlock('MATERIALS').matchAll(/"(\w+)"/g)].map((m) => m[1])

describe('model contract twin (contract.ts vs tools/blender/contract_spec.py)', () => {
  it('lists the same objects with the same types and parents, in the same order', () => {
    expect(pyObjects.length).toBeGreaterThan(0)
    expect(pyObjects).toEqual(CONTRACT_OBJECTS.map((o) => ({ name: o.name, type: o.type, parent: o.parent })))
  })

  it('lists the same node names', () => {
    expect(pyObjects.map((o) => o.name)).toEqual([...REQUIRED_NODE_NAMES])
  })

  it('lists the tea bag packets and their materials the same way', () => {
    expect(TEA_BAG_NAMES).toEqual(['TeaBag_0', 'TeaBag_1', 'TeaBag_2', 'TeaBag_3'])
    expect(specSource).toContain('TEA_BAG_NAMES = [f"TeaBag_{i}" for i in range(4)]')
    expect(specSource).toContain('TEA_BAG_MATERIALS = {f"TeaBag_{i}": f"Mat_Bag{i}" for i in range(4)}')
    TEA_BAG_NAMES.forEach((_n, i) => expect(pyMaterials).toContain(`Mat_Bag${i}`))
  })

  it('lists the same marker Empties', () => {
    expect(pyObjects.filter((o) => o.type === 'EMPTY').map((o) => o.name)).toEqual([...MARKER_NAMES])
  })

  it('lists the same materials', () => {
    expect(pyMaterials.length).toBeGreaterThan(0)
    expect(pyMaterials).toEqual([...MATERIAL_NAMES])
  })

  it('has the same budgets', () => {
    expect(pyNumber('TRIANGLE_TARGET')).toBe(BUDGETS.triangleTarget)
    expect(pyNumber('TRIANGLE_CAP')).toBe(BUDGETS.triangleCap)
    expect(pyNumber('GLB_MAX_MB')).toBe(BUDGETS.glbMaxMb)
    expect(pyNumber('MAX_MATERIALS')).toBe(BUDGETS.maxMaterials)
    expect(pyNumber('ORIGIN_TOL_MM')).toBe(BUDGETS.originToleranceMm)
  })

  it('requires the same Room UV layers and AO texture', () => {
    expect(pyString('ROOM_UV_LAYER')).toBe(ROOM_UV_LAYER)
    expect(pyString('ROOM_UV_AO_LAYER')).toBe(ROOM_UV_AO_LAYER)
    expect(ROOM_UV_AO_LAYER).toBe('UV_AO')
    expect(pyString('AO_TEXTURE_FILE')).toBe(AO_TEXTURE.file)
    expect(pyNumber('AO_TEXTURE_SIZE')).toBe(AO_TEXTURE.size)
    expect(pyNumber('AO_TEXTURE_MAX_SIZE')).toBe(AO_TEXTURE.maxSize)
  })

  it('matches SPEC.md section 5 structurally', () => {
    const names = REQUIRED_NODE_NAMES
    expect(new Set(names).size).toBe(names.length)
    expect(names.some((n) => /\.\d{3}$/.test(n))).toBe(false)
    const parents = Object.fromEntries(CONTRACT_OBJECTS.map((o) => [o.name, o.parent]))
    expect(parents.TeaSurface).toBe('Mug')
    expect(parents.Steam_Tea).toBe('Mug')
    expect(parents.Steam_Kettle).toBe('Kettle')
    // The tea bags are free-standing meshes (phase 3 lifts and clicks them), one per tea.
    expect(TEA_BAG_NAMES.map((n) => parents[n])).toEqual([null, null, null, null])
    expect(pyObjects.filter((o) => o.name?.startsWith('TeaBag_')).map((o) => o.name)).toEqual([...TEA_BAG_NAMES])
    expect(MATERIAL_NAMES.length).toBeLessThanOrEqual(BUDGETS.maxMaterials)
  })
})
