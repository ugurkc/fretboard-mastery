import { describe, expect, it } from 'vitest'
import { ACCIDENTALS, NATURALS, pitchClass } from './notes'
import type { NoteName } from './notes'
import { randomPair, run, setBeats, shuffled } from './sequence'
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
const labels = (beats: Beat[]) => beats.map((b) => `${b.note}${b.string}${b.direction}`)

const UP = [6, 5, 4, 3, 2, 1]
const DOWN = [1, 2, 3, 4, 5, 6]
const upLabels = (note: string) => UP.map((s) => `${note}${s}up`)
const downLabels = (note: string) => DOWN.map((s) => `${note}${s}down`)

describe('run', () => {
  it('goes 6 to 1 when up and 1 to 6 when down', () => {
    expect(strings(run('A', 'up'))).toEqual([6, 5, 4, 3, 2, 1])
    expect(strings(run('A', 'down'))).toEqual([1, 2, 3, 4, 5, 6])
    expect(run('A', 'up').every((b) => b.note === 'A' && b.direction === 'up')).toBe(true)
  })
})

describe('setBeats', () => {
  it('single-note exercises are three rounds of up then down', () => {
    for (const exercise of [1, 2] as const) {
      const beats = setBeats({ exercise, note: 'G' })
      expect(beats).toHaveLength(36)
      for (let round = 0; round < 3; round++) {
        expect(labels(beats.slice(round * 12, round * 12 + 12))).toEqual([...upLabels('G'), ...downLabels('G')])
      }
      expectNoSkippedStrings(beats)
    }
  })

  it('pairs play the first note up and the second down, three times', () => {
    const beats = setBeats({ exercise: 3, pair: ['G', 'D'] })
    expect(beats).toHaveLength(36)
    for (let round = 0; round < 3; round++) {
      expect(labels(beats.slice(round * 12, round * 12 + 12))).toEqual([...upLabels('G'), ...downLabels('D')])
    }
    expectNoSkippedStrings(beats)
  })

  it('the shuffled set alternates direction note by note', () => {
    const order: NoteName[] = ['D', 'F', 'C', 'E', 'A', 'G', 'B']
    const beats = setBeats({ exercise: 4, order })
    expect(beats).toHaveLength(42)
    order.forEach((note, i) => {
      const block = beats.slice(i * 6, i * 6 + 6)
      const direction = i % 2 === 0 ? 'up' : 'down'
      expect(block.every((b) => b.note === note)).toBe(true)
      expect(block.every((b) => b.direction === direction)).toBe(true)
      expect(strings(block)).toEqual(direction === 'up' ? UP : DOWN)
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

  it('actually reorders for some seed', () => {
    const outs = Array.from({ length: 10 }, (_, seed) => shuffled(NATURALS, seeded(seed)))
    expect(outs.some((out) => out.join() !== NATURALS.join())).toBe(true)
  })

  it('hits every order of three items about equally often', () => {
    const rng = seeded(42)
    const counts = new Map<string, number>()
    for (let i = 0; i < 6000; i++) {
      const key = shuffled([0, 1, 2], rng).join('')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect([...counts.keys()].sort()).toEqual(['012', '021', '102', '120', '201', '210'])
    for (const count of counts.values()) {
      expect(count).toBeGreaterThanOrEqual(850)
      expect(count).toBeLessThanOrEqual(1150)
    }
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

  it('does not always return the same pair', () => {
    const pairs = new Set(Array.from({ length: 50 }, (_, seed) => randomPair(NATURALS, seeded(seed)).join()))
    expect(pairs.size).toBeGreaterThan(1)
  })

  it('never returns an enharmonic pair', () => {
    const pool: NoteName[] = [...NATURALS, ...ACCIDENTALS]
    for (let seed = 0; seed < 200; seed++) {
      const [a, b] = randomPair(pool, seeded(seed))
      expect(pitchClass(a)).not.toBe(pitchClass(b))
    }
  })

  it('throws when the pool has no two different pitches', () => {
    expect(() => randomPair(['C#', 'Db'])).toThrow(RangeError)
    expect(() => randomPair(['C#', 'Db'])).toThrow('randomPair needs two notes with different pitches')
  })
})
