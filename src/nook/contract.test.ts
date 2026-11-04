import { describe, expect, it } from 'vitest'
import specSource from '../../tools/blender/contract_spec.py?raw'
import { BUDGETS, CONTRACT_OBJECTS, MARKER_NAMES, MATERIAL_NAMES, REQUIRED_NODE_NAMES } from './contract.ts'

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

  it('matches SPEC.md section 5 structurally', () => {
    const names = REQUIRED_NODE_NAMES
    expect(new Set(names).size).toBe(names.length)
    expect(names.some((n) => /\.\d{3}$/.test(n))).toBe(false)
    const parents = Object.fromEntries(CONTRACT_OBJECTS.map((o) => [o.name, o.parent]))
    expect(parents.TeaSurface).toBe('Mug')
    expect(parents.Steam_Tea).toBe('Mug')
    expect(parents.Steam_Kettle).toBe('Kettle')
    expect(MATERIAL_NAMES.length).toBeLessThanOrEqual(BUDGETS.maxMaterials)
  })
})
