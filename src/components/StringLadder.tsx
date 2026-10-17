import { OPEN_NAMES, STRINGS_DOWN } from '../lib/notes'
import type { StringNumber } from '../lib/notes'

export function StringLadder({ active }: { active: StringNumber | null }) {
  return (
    <ol className="ladder" aria-label="Strings, high e at the top">
      {STRINGS_DOWN.map((s) => (
        <li key={s} className={s === active ? 'is-active' : undefined} aria-current={s === active ? 'true' : undefined}>
          <span className="ladder-num">{s}</span>
          <span className="ladder-line" />
          <span className="ladder-name">{OPEN_NAMES[s]}</span>
        </li>
      ))}
    </ol>
  )
}
