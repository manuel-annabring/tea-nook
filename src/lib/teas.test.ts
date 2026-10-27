import { describe, expect, it } from 'vitest'
import { TEAS } from './teas.ts'

describe('TEAS', () => {
  it('has the four teas from the spec with unique ids', () => {
    expect(TEAS.map((t) => t.name)).toEqual(['Earl Grey', 'Green', 'Chamomile', 'Hibiscus'])
    expect(new Set(TEAS.map((t) => t.id)).size).toBe(4)
  })

  it('uses hex colors and positive density and speed', () => {
    for (const t of TEAS) {
      expect(t.steamColor).toMatch(/^#[0-9a-f]{6}$/)
      expect(t.liquidColor).toMatch(/^#[0-9a-f]{6}$/)
      expect(t.density).toBeGreaterThan(0)
      expect(t.speed).toBeGreaterThan(0)
    }
  })
})
