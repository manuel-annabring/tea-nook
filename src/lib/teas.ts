export interface Tea {
  id: string
  name: string
  /** Steam tint, sRGB hex. */
  steamColor: string
  /** Steam opacity multiplier. */
  density: number
  /** Steam rise speed multiplier. */
  speed: number
  /** Tea surface color in the mug, sRGB hex. */
  liquidColor: string
}

/** Starting values for the slice 1 dev panel; final values are tuned on the real model. */
export const TEAS: readonly Tea[] = [
  { id: 'earl-grey', name: 'Earl Grey', steamColor: '#e9dcc9', density: 0.79, speed: 1.21, liquidColor: '#8a4b2a' },
  { id: 'green', name: 'Green', steamColor: '#e3efdc', density: 0.6, speed: 1.03, liquidColor: '#b5b84a' },
  { id: 'chamomile', name: 'Chamomile', steamColor: '#f3ecd0', density: 0.7, speed: 0.91, liquidColor: '#e0b84a' },
  { id: 'hibiscus', name: 'Hibiscus', steamColor: '#f3d5dc', density: 1, speed: 1.45, liquidColor: '#b3213f' },
]
