import { beforeEach, describe, expect, it } from 'vitest'
import { TEAS } from '../lib/teas.ts'
import { useStore } from './useStore.ts'

describe('tea selection', () => {
  beforeEach(() => useStore.setState({ teaIndex: 0 }))

  it('nextTea advances and wraps after the last tea', () => {
    for (let i = 1; i < TEAS.length; i += 1) {
      useStore.getState().nextTea()
      expect(useStore.getState().teaIndex).toBe(i)
    }
    useStore.getState().nextTea()
    expect(useStore.getState().teaIndex).toBe(0)
  })

  it('setTea selects a valid index and ignores invalid ones', () => {
    useStore.getState().setTea(2)
    expect(useStore.getState().teaIndex).toBe(2)
    useStore.getState().setTea(-1)
    useStore.getState().setTea(TEAS.length)
    useStore.getState().setTea(1.5)
    expect(useStore.getState().teaIndex).toBe(2)
  })
})

describe('time of day', () => {
  it('starts in the morning and toggles back and forth', () => {
    expect(useStore.getState().timeOfDay).toBe('morning')
    useStore.getState().toggleTimeOfDay()
    expect(useStore.getState().timeOfDay).toBe('evening')
    useStore.getState().toggleTimeOfDay()
    expect(useStore.getState().timeOfDay).toBe('morning')
  })
})
