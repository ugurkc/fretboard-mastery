import { describe, expect, it } from 'vitest'
import { beatsInWindow } from './metronome'

describe('beatsInWindow', () => {
  it('lists beat times from nextTime up to (not including) the horizon', () => {
    expect(beatsInWindow(1, 2.6, 0.5)).toEqual([1, 1.5, 2, 2.5])
    expect(beatsInWindow(1, 1.25, 0.5)).toEqual([1])
  })

  it('returns nothing when the next beat is past the horizon', () => {
    expect(beatsInWindow(3, 2.9, 0.5)).toEqual([])
  })
})
