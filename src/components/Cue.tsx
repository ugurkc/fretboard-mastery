import { accidentalTip, displayName } from '../lib/notes'
import type { Beat } from '../lib/sequence'

interface Props {
  current: Beat | null
  upcoming: Beat | null
  countIn: number | null
}

export function Cue({ current, upcoming, countIn }: Props) {
  if (countIn !== null) {
    return (
      <div className="cue">
        <p className="cue-main">{countIn}</p>
        {upcoming && (
          <p className="cue-next">
            First: {displayName(upcoming.note)} on string {upcoming.string}
          </p>
        )}
      </div>
    )
  }
  if (current === null) {
    return (
      <div className="cue cue-idle">
        <p className="cue-main">{upcoming ? displayName(upcoming.note) : ''}</p>
        {upcoming && <p className="cue-next">Starts on string {upcoming.string}. Press Start when ready.</p>}
      </div>
    )
  }
  const tip = accidentalTip(current.note)
  const noteChanges = upcoming !== null && upcoming.note !== current.note
  return (
    <div className="cue">
      <p className="cue-main">
        {displayName(current.note)}
        <span className="cue-string"> string {current.string}</span>
        <span className="cue-dir" aria-hidden="true">
          {current.direction === 'up' ? ' ↑' : ' ↓'}
        </span>
      </p>
      {tip && <p className="cue-tip">{tip}</p>}
      <p className="cue-next">
        {upcoming === null
          ? 'Last one'
          : `Next: ${noteChanges ? `${displayName(upcoming.note)} on ` : ''}string ${upcoming.string}`}
      </p>
    </div>
  )
}
