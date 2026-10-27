import { describe, expect, it } from 'vitest'
import { assetUrl } from './assetUrl.ts'

describe('assetUrl', () => {
  it('prefixes the base path', () => {
    expect(assetUrl('models/nook.glb', '/tea-nook/')).toBe('/tea-nook/models/nook.glb')
  })

  it('ignores a leading slash on the path', () => {
    expect(assetUrl('/models/nook.glb', '/tea-nook/')).toBe('/tea-nook/models/nook.glb')
  })
})
