import { pitchClass, STRINGS_DOWN, STRINGS_UP } from './notes'
import type { NoteName, StringNumber } from './notes'

export type Direction = 'up' | 'down'
export type Exercise = 1 | 2 | 3 | 4 | 5

export interface Beat {
  readonly note: NoteName
  readonly string: StringNumber
  readonly direction: Direction
}

export const ROUNDS_PER_SET = 3
export const BEATS_PER_RUN = 6

export type SetConfig =
  | { exercise: 1 | 2 | 3; note: NoteName }
  | { exercise: 4; pair: [NoteName, NoteName] }
  | { exercise: 5; order: readonly NoteName[] }

export function run(note: NoteName, direction: Direction): Beat[] {
  const strings = direction === 'up' ? STRINGS_UP : STRINGS_DOWN
  return strings.map((string) => ({ note, string, direction }))
}

function repeat<T>(items: T[], times: number): T[] {
  return Array.from({ length: times }, () => items).flat()
}

/** Every beat of one practice set, in order. */
export function setBeats(config: SetConfig): Beat[] {
  if (config.exercise === 4) {
    const [first, second] = config.pair
    return repeat([...run(first, 'up'), ...run(second, 'down')], ROUNDS_PER_SET)
  }
  if (config.exercise === 5) {
    return config.order.flatMap((note, i) => run(note, i % 2 === 0 ? 'up' : 'down'))
  }
  return repeat([...run(config.note, 'up'), ...run(config.note, 'down')], ROUNDS_PER_SET)
}

/** Fisher-Yates; returns a new array. */
export function shuffled<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function randomPair(pool: readonly NoteName[], rng: () => number = Math.random): [NoteName, NoteName] {
  const [first, ...rest] = shuffled(pool, rng)
  const second = rest.find((note) => pitchClass(note) !== pitchClass(first))
  if (first === undefined || second === undefined) {
    throw new RangeError('randomPair needs two notes with different pitches')
  }
  return [first, second]
}
