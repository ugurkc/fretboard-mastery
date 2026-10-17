import { describe, expect, it } from 'vitest'
import { NATURALS } from './notes'
import type { NoteName } from './notes'
import { ROUNDS_PER_SET, randomPair, run, setBeats, shuffled } from './sequence'
import type { Beat } from './sequence'

// Deterministic RNG so shuffle tests are repeatable.
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function expectNoSkippedStrings(beats: Beat[]) {
  for (let i = 1; i < beats.length; i++) {
    expect(Math.abs(beats[i].string - beats[i - 1].string)).toBeLessThanOrEqual(1)
  }
}

const strings = (beats: Beat[]) => beats.map((b) => b.string)

describe('run', () => {
  it('goes 6 to 1 when up and 1 to 6 when down', () => {
    expect(strings(run('A', 'up'))).toEqual([6, 5, 4, 3, 2, 1])
    expect(strings(run('A', 'down'))).toEqual([1, 2, 3, 4, 5, 6])
    expect(run('A', 'up').every((b) => b.note === 'A' && b.direction === 'up')).toBe(true)
  })
})

describe('setBeats', () => {
  it('single-note exercises are three rounds of up then down', () => {
    for (const exercise of [1, 2, 3] as const) {
      const beats = setBeats({ exercise, note: 'G' })
      expect(beats).toHaveLength(ROUNDS_PER_SET * 12)
      expect(strings(beats.slice(0, 12))).toEqual([6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6])
      expect(beats.every((b) => b.note === 'G')).toBe(true)
      expectNoSkippedStrings(beats)
    }
  })

  it('pairs play the first note up and the second down, three times', () => {
    const beats = setBeats({ exercise: 4, pair: ['G', 'D'] })
    expect(beats).toHaveLength(ROUNDS_PER_SET * 12)
    expect(beats.slice(0, 6).every((b) => b.note === 'G' && b.direction === 'up')).toBe(true)
    expect(beats.slice(6, 12).every((b) => b.note === 'D' && b.direction === 'down')).toBe(true)
    expectNoSkippedStrings(beats)
  })

  it('the shuffled set alternates direction note by note', () => {
    const order: NoteName[] = ['D', 'F', 'C', 'E', 'A', 'G', 'B']
    const beats = setBeats({ exercise: 5, order })
    expect(beats).toHaveLength(42)
    order.forEach((note, i) => {
      const block = beats.slice(i * 6, i * 6 + 6)
      expect(block.every((b) => b.note === note)).toBe(true)
      expect(block[0].direction).toBe(i % 2 === 0 ? 'up' : 'down')
    })
    expectNoSkippedStrings(beats)
  })
})

describe('shuffled', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [...NATURALS]
    const out = shuffled(input, seeded(1))
    expect(input).toEqual([...NATURALS])
    expect([...out].sort()).toEqual([...NATURALS].sort())
  })

  it('is deterministic for a given rng', () => {
    expect(shuffled(NATURALS, seeded(7))).toEqual(shuffled(NATURALS, seeded(7)))
  })
})

describe('randomPair', () => {
  it('picks two different notes from the pool', () => {
    for (let seed = 0; seed < 50; seed++) {
      const [a, b] = randomPair(NATURALS, seeded(seed))
      expect(a).not.toBe(b)
      expect(NATURALS).toContain(a)
      expect(NATURALS).toContain(b)
    }
  })
})
