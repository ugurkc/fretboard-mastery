export const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export const ACCIDENTALS = ['C#', 'Db', 'D#', 'Eb', 'F#', 'Gb', 'G#', 'Ab', 'A#', 'Bb'] as const
/** One name per black-key pitch: the step 0 chips. */
export const SHARPS = ['C#', 'D#', 'F#', 'G#', 'A#'] as const

export type Natural = (typeof NATURALS)[number]
export type Accidental = (typeof ACCIDENTALS)[number]
export type NoteName = Natural | Accidental
export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6

/** Low E to high E: the direction the method calls "up". */
export const STRINGS_UP: readonly StringNumber[] = [6, 5, 4, 3, 2, 1]
export const STRINGS_DOWN: readonly StringNumber[] = [1, 2, 3, 4, 5, 6]
export const OPEN_NAMES: Record<StringNumber, string> = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' }

export const WINDOW_SIZE = 12
export const MIN_WINDOW_START = 1
export const MAX_WINDOW_START = 10

const NATURAL_PITCH: Record<Natural, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
// Standard tuning; string 1 is the high E.
const OPEN_PITCH: Record<StringNumber, number> = { 6: 4, 5: 9, 4: 2, 3: 7, 2: 11, 1: 4 }
const PITCH_LABELS = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B']

const ALL_NAMES: readonly string[] = [...NATURALS, ...ACCIDENTALS]

export function isNoteName(value: unknown): value is NoteName {
  return typeof value === 'string' && ALL_NAMES.includes(value)
}

export function isNatural(note: NoteName): note is Natural {
  return note.length === 1
}

export function pitchClass(note: NoteName): number {
  const base = NATURAL_PITCH[note[0] as Natural]
  const shift = note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0
  return (base + shift + 12) % 12
}

/** The fret where `note` sits on `string` inside the 12-fret window starting at `windowStart`. */
export function fretFor(note: NoteName, string: StringNumber, windowStart: number): number {
  const offset = (((pitchClass(note) - OPEN_PITCH[string] - windowStart) % 12) + 12) % 12
  return windowStart + offset
}

export function chartLabel(string: StringNumber, fret: number): string {
  return PITCH_LABELS[(OPEN_PITCH[string] + fret) % 12]
}

/** The chart label of the note's pitch, e.g. 'A' or 'C♯/D♭'. */
export function pitchLabel(note: NoteName): string {
  return PITCH_LABELS[pitchClass(note)]
}

export interface Position {
  string: StringNumber
  fret: number
}

/** Where `note` sits on each string, strings 1 to 6, inside the window starting at `windowStart`. */
export function positionsOf(note: NoteName, windowStart: number): Position[] {
  return STRINGS_DOWN.map((string) => ({ string, fret: fretFor(note, string, windowStart) }))
}

export function displayName(note: NoteName): string {
  return note.replace('#', '♯').replace(/^([A-G])b$/, '$1♭')
}

export function accidentalTip(note: NoteName): string | null {
  if (isNatural(note)) return null
  const direction = note[1] === '#' ? 'up' : 'down'
  return `Find ${note[0]}, then go ${direction} one fret`
}

export function clampWindowStart(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return MIN_WINDOW_START
  return Math.min(MAX_WINDOW_START, Math.max(MIN_WINDOW_START, value))
}
