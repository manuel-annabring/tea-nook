// The flat surfaces a sun ray can end on and the window frame the light has to pass, in three.js world coordinates
// (meters, y up). The one place these numbers live in the app: the model is merged by material, so they cannot be read
// from its geometry. They mirror the parameters of `tools/blender/steps/04_room.py` (Blender y is -z here);
// `roomSurfaces.test.ts` parses that script and fails if the two differ.

import type { FrameShape, RoomSurfaces } from './beam.ts'

export const ROOM_SURFACES = {
  /** Top of the worktop (its origin is the world origin). */
  worktop: { y: 0, xMin: -0.3, xMax: 0.3, zMin: -0.225, zMax: 0.225 },
  /** Room-side face of the back wall, from the left wall to the right end of the floor. */
  backWall: { z: -0.225, xMin: -0.3, xMax: 0.6, yMin: -0.33, yMax: 0.5 },
  /** Floor slab under the boards (the boards add 4 to 6 mm). */
  floor: { y: -0.33, xMin: -0.3, xMax: 0.6, zMin: -0.225, zMax: 0.475 },
} as const satisfies RoomSurfaces

export const WINDOW_FRAME = {
  /** Width of the outer frame bars, which line the opening and so lie inside the `Window_Glass` bounds. */
  width: 0.02,
  /** Half the depth of those bars: they reach this far in front of and behind the glass. */
  halfDepth: 0.015,
  /** Width of the two cross bars between the four panes. */
  mullionWidth: 0.012,
} as const satisfies FrameShape
