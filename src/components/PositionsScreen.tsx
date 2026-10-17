import { useState } from 'react'
import { NATURALS, OPEN_NAMES, SHARPS, STRINGS_DOWN, WINDOW_SIZE, isNatural, pitchLabel, positionsOf } from '../lib/notes'
import type { NoteName } from '../lib/notes'
import { STEP_INFO } from '../lib/steps'
import { FretWindowSelect } from './FretWindowSelect'

interface Props {
  windowStart: number
  onWindowChange: (windowStart: number) => void
  onStartPractice: () => void
}

/** Fret-dot inlays as on a real neck: one dot at 3, 5, 7 and 9, two at 12 (and again an octave up). */
function inlayDots(fret: number): number {
  const f = fret % 12
  if (f === 0) return 2
  return f === 3 || f === 5 || f === 7 || f === 9 ? 1 : 0
}

/** Step 0: a study page. Every position of the chosen note in the current fret window. */
export function PositionsScreen({ windowStart, onWindowChange, onStartPractice }: Props) {
  const [note, setNote] = useState<NoteName>('C')
  const [withSharps, setWithSharps] = useState(false)
  const info = STEP_INFO[0]

  const chips: readonly NoteName[] = withSharps ? [...NATURALS, ...SHARPS] : NATURALS
  const frets = Array.from({ length: WINDOW_SIZE }, (_, i) => windowStart + i)
  const fretOn = new Map(positionsOf(note, windowStart).map((p) => [p.string, p.fret]))
  const label = pitchLabel(note)
  // 'C♯/D♭' is drawn as C♯ over D♭ and read out as "C♯ or D♭".
  const names = label.split('/')
  const tableClass = windowStart === 1 ? 'positions from-nut' : 'positions'

  return (
    <main className="practice">
      <section className="brief">
        <h2>Step 0: {info.label}</h2>
        <p>{info.instructions}</p>
        <p className="goal">
          <strong>Goal:</strong> {info.goal}
        </p>
      </section>

      <section className="controls">
        <div className="picker" role="group" aria-label="Note">
          {chips.map((n) => (
            <button
              key={n}
              type="button"
              className={n === note ? 'chip is-selected' : 'chip'}
              aria-pressed={n === note}
              onClick={() => setNote(n)}
            >
              {pitchLabel(n)}
            </button>
          ))}
        </div>
        <div className="positions-options">
          <label className="check">
            <input
              type="checkbox"
              checked={withSharps}
              onChange={(e) => {
                setWithSharps(e.target.checked)
                if (!e.target.checked && !isNatural(note)) setNote('C')
              }}
            />{' '}
            Sharps &amp; flats
          </label>
          <FretWindowSelect windowStart={windowStart} onChange={onWindowChange} />
        </div>
      </section>

      <div className="chart-scroll">
        <table className={tableClass}>
          <caption>
            <span>
              Where {label} sits in frets {windowStart}–{windowStart + WINDOW_SIZE - 1}
            </span>
          </caption>
          <thead>
            <tr>
              <th scope="col">String</th>
              {frets.map((f) => (
                <th key={f} scope="col">
                  {f}
                  <span className="inlay" aria-hidden="true">
                    {Array.from({ length: inlayDots(f) }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STRINGS_DOWN.map((s) => (
              <tr key={s} className={`string-${s}`}>
                <th scope="row">
                  {s} <span className="muted">{OPEN_NAMES[s]}</span>
                </th>
                {frets.map((f) => (
                  <td key={f}>
                    {fretOn.get(s) === f && (
                      <span className={names.length > 1 ? 'dot is-pair' : 'dot'}>
                        {names.length > 1 ? (
                          <>
                            {names.map((part) => (
                              <span key={part} aria-hidden="true">
                                {part}
                              </span>
                            ))}
                            <span className="sr-only">{names.join(' or ')}</span>
                          </>
                        ) : (
                          label
                        )}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="actions">
        <button type="button" className="primary" onClick={onStartPractice}>
          Start step 1
        </button>
      </div>
    </main>
  )
}
