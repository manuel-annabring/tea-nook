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

// Colours the app deliberately sets differently from the Blender default (the runtime palette wins, D-009). The
// Blender material keeps the old value because nook.blend is not touched by look decisions.
const APP_OVERRIDES: Record<string, string> = {
  // F5: dusty blue wall (D-068); the Blender default is the original cream.
  Mat_Wall: '#F2E6D0',
}

describe('PALETTE', () => {
  it('has exactly the contract material names', () => {
    expect(Object.keys(PALETTE).sort()).toEqual([...MATERIAL_NAMES].sort())
  })

  it('matches the Blender-side defaults in 01_blockout.py, except the listed app overrides', () => {
    const upper = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, v.toUpperCase()]))
    expect(blockoutPalette()).toEqual({ ...upper, ...APP_OVERRIDES })
  })

  it('only overrides colours that really differ from the Blender default', () => {
    for (const [name, blender] of Object.entries(APP_OVERRIDES)) {
      expect(PALETTE[name as keyof typeof PALETTE].toUpperCase()).not.toBe(blender.toUpperCase())
    }
  })
})
