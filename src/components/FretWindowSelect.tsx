import { MAX_WINDOW_START, MIN_WINDOW_START, WINDOW_SIZE } from '../lib/notes'

const WINDOW_STARTS = Array.from(
  { length: MAX_WINDOW_START - MIN_WINDOW_START + 1 },
  (_, i) => MIN_WINDOW_START + i,
)

interface Props {
  windowStart: number
  onChange: (windowStart: number) => void
}

/** The "Frets" select: which 12 frets the charts show. */
export function FretWindowSelect({ windowStart, onChange }: Props) {
  return (
    <label>
      Frets{' '}
      <select value={windowStart} onChange={(e) => onChange(Number(e.target.value))}>
        {WINDOW_STARTS.map((s) => (
          <option key={s} value={s}>
            {s}–{s + WINDOW_SIZE - 1}
          </option>
        ))}
      </select>
    </label>
  )
}
