import { describe, expect, it } from 'vitest'
import roomScript from '../../tools/blender/steps/04_room.py?raw'
import { ROOM_SURFACES, WINDOW_FRAME } from './roomSurfaces.ts'

// roomSurfaces.ts repeats a few parameters of the script that builds `Room`. These tests parse the script as text
// (no Python needed) so the two cannot drift apart silently.

/** The values of a `NAME = number` or `A, B = 1.0, 2.0` line (also the second name of such a line). */
function py(name: string): number {
  for (const line of roomScript.split('\n')) {
    const match = /^([A-Z0-9_]+(?:, [A-Z0-9_]+)*) = \(?(-?[\d.]+(?:, -?[\d.]+)*)\)?(?:\s*#.*)?$/.exec(line)
    if (!match?.[1] || !match[2]) continue
    const index = match[1].split(', ').indexOf(name)
    const value = Number(match[2].split(', ')[index])
    if (index >= 0 && Number.isFinite(value)) return value
  }
  throw new Error(`04_room.py: number ${name} not found`)
}

/** A `NAME = (a, b)` line. */
function pyPair(name: string): [number, number] {
  const match = new RegExp(`^${name} = \\((-?[\\d.]+), (-?[\\d.]+)\\)`, 'm').exec(roomScript)
  if (!match?.[1] || !match[2]) throw new Error(`04_room.py: pair ${name} not found`)
  return [Number(match[1]), Number(match[2])]
}

describe('room surfaces mirror 04_room.py', () => {
  const halfX = py('COUNTER_X') / 2
  const halfY = py('COUNTER_Y') / 2
  const floorY = -(py('COUNTER_T') + py('CABINET_H'))
  const right = halfX + py('FLOOR_RIGHT')
  const { worktop, backWall, floor } = ROOM_SURFACES

  it('worktop', () => {
    expect(worktop.y).toBe(0)
    expect([worktop.xMin, worktop.xMax]).toEqual([-halfX, halfX])
    expect([worktop.zMin, worktop.zMax]).toEqual([-halfY, halfY])
  })

  it('back wall', () => {
    expect(backWall.z).toBeCloseTo(-halfY, 10)
    expect(backWall.xMin).toBeCloseTo(-halfX, 10)
    expect(backWall.xMax).toBeCloseTo(right, 10)
    expect(backWall.yMin).toBeCloseTo(floorY, 10)
    expect(backWall.yMax).toBeCloseTo(py('WALL_H'), 10)
  })

  it('floor', () => {
    expect(floor.y).toBeCloseTo(floorY, 10)
    expect(floor.xMin).toBeCloseTo(-halfX, 10)
    expect(floor.xMax).toBeCloseTo(right, 10)
    expect(floor.zMin).toBeCloseTo(-halfY, 10)
    // Blender front (-Y) is +z.
    expect(floor.zMax).toBeCloseTo(halfY + py('FLOOR_FRONT'), 10)
  })

  it('window frame and cross bars', () => {
    const [back, front] = pyPair('FRAME_X')
    expect(WINDOW_FRAME.width).toBe(py('FRAME_W'))
    expect(WINDOW_FRAME.halfDepth).toBeCloseTo((front - back) / 2, 10)
    expect(WINDOW_FRAME.mullionWidth).toBe(py('MULLION_W'))
  })
})
