import { describe, expect, it } from 'vitest'
import {
  ACCIDENTALS,
  MAX_WINDOW_START,
  MIN_WINDOW_START,
  NATURALS,
  SHARPS,
  STRINGS_DOWN,
  WINDOW_SIZE,
  accidentalTip,
  chartLabel,
  clampWindowStart,
  displayName,
  fretFor,
  isNoteName,
  pitchClass,
  pitchLabel,
  positionsOf,
} from './notes'
import type { NoteName, StringNumber } from './notes'

const ALL_NOTES = [...NATURALS, ...ACCIDENTALS]
const OPEN: [StringNumber, NoteName][] = [
  [6, 'E'],
  [5, 'A'],
  [4, 'D'],
  [3, 'G'],
  [2, 'B'],
  [1, 'E'],
]

describe('pitchClass', () => {
  it('maps naturals and enharmonic pairs', () => {
    expect(pitchClass('C')).toBe(0)
    expect(pitchClass('A')).toBe(9)
    expect(pitchClass('C#')).toBe(1)
    expect(pitchClass('Db')).toBe(1)
    expect(pitchClass('A#')).toBe(pitchClass('Bb'))
  })
})

describe('fretFor', () => {
  it('finds known positions in frets 1-12', () => {
    expect(fretFor('A', 6, 1)).toBe(5)
    expect(fretFor('E', 6, 1)).toBe(12)
    expect(fretFor('F', 6, 1)).toBe(1)
    expect(fretFor('A', 5, 1)).toBe(12)
    expect(fretFor('C', 2, 1)).toBe(1)
    expect(fretFor('D', 1, 1)).toBe(10)
  })

  it('fret 12 on each string is the open note', () => {
    for (const [s, n] of OPEN) {
      expect(chartLabel(s, 12)).toBe(n)
      expect(fretFor(n, s, 1)).toBe(12)
    }
  })

  it('puts sharps one fret above and flats one fret below their natural', () => {
    expect(fretFor('A#', 6, 1)).toBe(fretFor('A', 6, 1) + 1)
    expect(fretFor('Bb', 6, 1)).toBe(fretFor('B', 6, 1) - 1)
  })

  it('respects a shifted window', () => {
    expect(fretFor('E', 6, 5)).toBe(12)
    expect(fretFor('F', 6, 5)).toBe(13)
  })

  it('places every note exactly once per string inside every window', () => {
    for (let start = MIN_WINDOW_START; start <= MAX_WINDOW_START; start++) {
      for (const string of STRINGS_DOWN) {
        for (const note of ALL_NOTES) {
          const fret = fretFor(note, string, start)
          expect(fret).toBeGreaterThanOrEqual(start)
          expect(fret).toBeLessThan(start + WINDOW_SIZE)
          expect(chartLabel(string, fret).split('/')).toContain(displayName(note))
        }
      }
    }
  })
})

describe('chartLabel', () => {
  it('labels naturals plainly and accidentals with both names', () => {
    expect(chartLabel(6, 5)).toBe('A')
    expect(chartLabel(6, 6)).toBe('A♯/B♭')
  })
})

describe('displayName', () => {
  it('uses music symbols', () => {
    expect(displayName('A')).toBe('A')
    expect(displayName('C#')).toBe('C♯')
    expect(displayName('Bb')).toBe('B♭')
  })
})

describe('accidentalTip', () => {
  it('explains sharps and flats relative to the natural', () => {
    expect(accidentalTip('A#')).toBe('Find A, then go up one fret')
    expect(accidentalTip('Bb')).toBe('Find B, then go down one fret')
    expect(accidentalTip('G')).toBeNull()
  })
})

describe('isNoteName', () => {
  it('accepts the 17 practice names and nothing else', () => {
    for (const n of ALL_NOTES) expect(isNoteName(n)).toBe(true)
    expect(isNoteName('H')).toBe(false)
    expect(isNoteName('E#')).toBe(false)
    expect(isNoteName(3)).toBe(false)
  })
})

describe('clampWindowStart', () => {
  it('clamps to 1-10 and rejects non-integers', () => {
    expect(clampWindowStart(5)).toBe(5)
    expect(clampWindowStart(0)).toBe(1)
    expect(clampWindowStart(99)).toBe(10)
    expect(clampWindowStart(2.5)).toBe(1)
    expect(clampWindowStart('3')).toBe(1)
  })
})

describe('SHARPS', () => {
  it('names each of the five black-key pitches once, as a sharp', () => {
    expect(SHARPS).toEqual(['C#', 'D#', 'F#', 'G#', 'A#'])
    for (const note of SHARPS) expect(ACCIDENTALS).toContain(note)
    expect(SHARPS.map(pitchClass)).toEqual([1, 3, 6, 8, 10])
  })
})

describe('pitchLabel', () => {
  it('labels the pitch class the way the chart does', () => {
    expect(pitchLabel('G')).toBe('G')
    expect(pitchLabel('C#')).toBe('C♯/D♭')
    expect(pitchLabel('Db')).toBe('C♯/D♭')
    expect(pitchLabel('Bb')).toBe('A♯/B♭')
    for (const note of ALL_NOTES) {
      for (const string of STRINGS_DOWN) {
        expect(pitchLabel(note)).toBe(chartLabel(string, fretFor(note, string, 1)))
      }
    }
  })
})

describe('positionsOf', () => {
  it('finds C on every string in frets 1-12', () => {
    expect(positionsOf('C', 1)).toEqual([
      { string: 1, fret: 8 },
      { string: 2, fret: 1 },
      { string: 3, fret: 5 },
      { string: 4, fret: 10 },
      { string: 5, fret: 3 },
      { string: 6, fret: 8 },
    ])
  })

  it('gives one position per string, strings 1 to 6, for every note and window', () => {
    for (let start = MIN_WINDOW_START; start <= MAX_WINDOW_START; start++) {
      for (const note of ALL_NOTES) {
        const positions = positionsOf(note, start)
        expect(positions).toHaveLength(6)
        expect(positions.map((p) => p.string)).toEqual([1, 2, 3, 4, 5, 6])
        for (const { string, fret } of positions) expect(fret).toBe(fretFor(note, string, start))
      }
    }
  })

  it('follows the window', () => {
    expect(positionsOf('E', 5).map((p) => p.fret)).toEqual([12, 5, 9, 14, 7, 12])
  })

  it('gives enharmonics identical positions', () => {
    const pairs: [NoteName, NoteName][] = [
      ['C#', 'Db'],
      ['D#', 'Eb'],
      ['F#', 'Gb'],
      ['G#', 'Ab'],
      ['A#', 'Bb'],
    ]
    for (let start = MIN_WINDOW_START; start <= MAX_WINDOW_START; start++) {
      for (const [sharp, flat] of pairs) expect(positionsOf(sharp, start)).toEqual(positionsOf(flat, start))
    }
  })
})
