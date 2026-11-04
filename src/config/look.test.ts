import { describe, expect, it } from 'vitest'
import blockoutSource from '../../tools/blender/steps/01_blockout.py?raw'
import { MATERIAL_NAMES } from '../nook/contract.ts'
import { PALETTE } from './look.ts'

// The palette exists in three hand-kept copies: look.ts (runtime, wins), 01_blockout.py (Blender
// defaults) and the contract's material list. These tests keep them from drifting apart.

function blockoutPalette(): Record<string, string> {
  const block = /^PALETTE = \{\n([\s\S]*?)^\}/m.exec(blockoutSource)?.[1]
  if (!block) throw new Error('01_blockout.py: PALETTE not found')
  const out: Record<string, string> = {}
  for (const m of block.matchAll(/"(Mat_\w+)":\s*"(#[0-9A-Fa-f]{6})"/g)) {
    if (m[1] && m[2]) out[m[1]] = m[2].toUpperCase()
  }
  return out
}

describe('PALETTE', () => {
  it('has exactly the contract material names', () => {
    expect(Object.keys(PALETTE).sort()).toEqual([...MATERIAL_NAMES].sort())
  })

  it('matches the Blender-side defaults in 01_blockout.py', () => {
    const upper = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.toUpperCase()]))
    expect(blockoutPalette()).toEqual(upper)
  })
})
