import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import { ACCIDENTALS, NATURALS, displayName, isNatural, pitchClass } from '../lib/notes'
import type { NoteName } from '../lib/notes'
import { BEATS_PER_RUN, randomPair, setBeats, shuffled } from '../lib/sequence'
import type { Exercise, SetConfig } from '../lib/sequence'
import {
  BASE_BPM,
  BPM_STEP,
  MAX_BPM,
  MIN_BPM,
  doneItems,
  localDateKey,
  stepProgressText,
  suggestNextBpm,
} from '../lib/progress'
import type { PracticeStep, Progress, ProgressEvent } from '../lib/progress'
import { STEP_INFO } from '../lib/steps'
import { Metronome } from '../lib/metronome'
import { Cue } from './Cue'
import { StringLadder } from './StringLadder'

const COUNT_IN = 4
const DRILLS: readonly Exercise[] = [1, 2, 3, 4]
// One for the whole app, so step changes don't each open an AudioContext (made on first start).
const metronome = new Metronome()

type Phase = 'idle' | 'running' | 'confirm'

const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))

interface Props {
  step: PracticeStep
  progress: Progress
  dispatch: Dispatch<ProgressEvent>
  /** Arriving from "Start step 1": scroll to the top and focus the step heading. */
  focusHeading?: boolean
}

export function PracticeScreen({ step, progress, dispatch, focusHeading = false }: Props) {
  const [drill, setDrill] = useState<Exercise>(1)
  const exercise: Exercise = step === 5 ? drill : step
  const [bpm, setBpm] = useState(() => clampBpm(progress.bestBpm[1] || BASE_BPM))
  const tempo = step === 5 ? bpm : BASE_BPM

  const [chosenNote, setChosenNote] = useState<NoteName | null>(null)
  const [withAccidentals, setWithAccidentals] = useState(false)
  const [pair, setPair] = useState<[NoteName, NoteName]>(() => randomPair(NATURALS))
  const [order, setOrder] = useState<NoteName[]>(() => shuffled(NATURALS))

  const [phase, setPhase] = useState<Phase>('idle')
  const [index, setIndex] = useState(0)
  const startedAt = useRef<number | null>(null)
  const stopButton = useRef<HTMLButtonElement>(null)
  const startButton = useRef<HTMLButtonElement>(null)
  const confirmBox = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const lastPhase = useRef<Phase>(phase)
  const questionId = useId()

  const pool: readonly NoteName[] = exercise === 2 ? ACCIDENTALS : NATURALS
  const done: readonly NoteName[] = exercise === 1 || exercise === 2 ? doneItems(progress, exercise) : []
  const note =
    chosenNote && pool.includes(chosenNote) ? chosenNote : (pool.find((n) => !done.includes(n)) ?? pool[0])
  const pairPool: readonly NoteName[] = withAccidentals ? [...NATURALS, ...ACCIDENTALS] : NATURALS

  const config: SetConfig =
    exercise === 3 ? { exercise, pair } : exercise === 4 ? { exercise, order } : { exercise, note }
  const beats = setBeats(config)

  const busy = phase !== 'idle'
  const running = phase === 'running'

  function logPractice() {
    if (startedAt.current === null) return
    const seconds = (Date.now() - startedAt.current) / 1000
    startedAt.current = null
    dispatch({ type: 'practiced', date: localDateKey(new Date()), seconds })
  }

  function finish() {
    logPractice()
    setPhase('confirm')
  }

  function start() {
    startedAt.current = Date.now()
    setPhase('running')
    setIndex(-COUNT_IN)
    metronome.start({
      bpm: tempo,
      countIn: COUNT_IN,
      totalBeats: beats.length,
      isAccent: (i) => i % BEATS_PER_RUN === 0,
      onBeat: setIndex,
      onDone: finish,
    })
  }

  function stop() {
    metronome.stop()
    logPractice()
    setPhase('idle')
  }

  function answer(clean: boolean) {
    setPhase('idle')
    if (!clean) return
    dispatch({
      type: 'cleanSet',
      exercise,
      note: exercise <= 2 ? note : undefined,
      bpm: tempo,
    })
    if (step !== 5) setChosenNote(null) // move on to the next unticked note
    else if (exercise <= 2) setChosenNote(note) // same note again, faster; ticking it must not move us on
    if (exercise === 4) setOrder(shuffled(NATURALS))
    if (step === 5) setBpm(suggestNextBpm(tempo))
  }

  // Keep focus on the control that matters for the phase. The clean prompt focuses its group,
  // not "Yes", so a stray Space or Enter can't record a clean set. Start is refocused only on
  // returning to idle, never on first mount, so loading the page doesn't move focus.
  useEffect(() => {
    if (phase === 'running') stopButton.current?.focus()
    else if (phase === 'confirm') confirmBox.current?.focus()
    else if (lastPhase.current !== 'idle') startButton.current?.focus()
    lastPhase.current = phase
  }, [phase])

  // Opened from step 0's "Start step 1": the button that had focus is gone, so start the new
  // step from its heading. Tab clicks pass false and keep focus on the tab.
  useEffect(() => {
    if (!focusHeading) return
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [focusHeading])

  // Leaving the step (the parent remounts us per step) stops the click and keeps the time.
  // A layout effect, so this cleanup runs inside the commit that swaps screens: the shared
  // metronome is stopped before the next screen can be clicked, never after its Start.
  // It captures the first render's logPractice and dispatch; that is safe because App passes
  // useReducer's dispatch, which is stable.
  useLayoutEffect(
    () => () => {
      metronome.stop()
      logPractice()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only; logPractice reads refs
    [],
  )

  const current = running && index >= 0 ? beats[index] : null
  // During the count-in (index < 0) the next beat is the first one.
  const upcoming = running ? (beats[Math.max(index, -1) + 1] ?? null) : beats[0]
  const countIn = running && index < 0 ? -index : null
  const currentRun = running && index >= 0 ? Math.floor(index / BEATS_PER_RUN) : -1
  const info = STEP_INFO[step]

  return (
    <main className="practice">
      <section className="brief">
        <h2 ref={heading} tabIndex={-1}>
          Step {step}: {info.label}
        </h2>
        <p>{info.instructions}</p>
        <p className="goal">
          <strong>Goal:</strong> {info.goal}
        </p>
        <p className="status">
          {stepProgressText(progress, step)}
          {step !== 5 && <> · Tempo {BASE_BPM} BPM</>}
        </p>
      </section>

      <section className="controls">
        {step === 5 && (
          <div className="drill">
            <div className="picker" role="group" aria-label="Exercise">
              {DRILLS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={d === drill ? 'chip is-selected' : 'chip'}
                  aria-pressed={d === drill}
                  disabled={busy}
                  onClick={() => {
                    setDrill(d)
                    setBpm(clampBpm(progress.bestBpm[d] || BASE_BPM))
                  }}
                >
                  Step {d}
                </button>
              ))}
            </div>
            <div className="tempo">
              <button
                type="button"
                aria-label="Slower"
                disabled={busy || bpm <= MIN_BPM}
                onClick={() => setBpm(Math.max(MIN_BPM, bpm - BPM_STEP))}
              >
                −
              </button>
              <output>{bpm} BPM</output>
              <button
                type="button"
                aria-label="Faster"
                disabled={busy || bpm >= MAX_BPM}
                onClick={() => setBpm(Math.min(MAX_BPM, bpm + BPM_STEP))}
              >
                +
              </button>
              <span className="muted">Best clean: {progress.bestBpm[drill] || '—'} BPM</span>
            </div>
          </div>
        )}

        {exercise <= 2 && (
          <div className="picker" role="group" aria-label="Note">
            {pool.map((n) => {
              const ticked = done.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  className={['chip', n === note && 'is-selected', ticked && 'is-done'].filter(Boolean).join(' ')}
                  aria-pressed={n === note}
                  disabled={busy}
                  onClick={() => setChosenNote(n)}
                >
                  {displayName(n)}
                  {ticked && ' ✓'}
                </button>
              )
            })}
          </div>
        )}

        {exercise === 3 && (
          <div className="pair">
            <label>
              Up{' '}
              <select
                value={pair[0]}
                disabled={busy}
                onChange={(e) => {
                  const up = e.target.value as NoteName
                  const down =
                    pitchClass(up) === pitchClass(pair[1])
                      ? (pairPool.find((n) => pitchClass(n) !== pitchClass(up)) ?? pair[1])
                      : pair[1]
                  setPair([up, down])
                }}
              >
                {pairPool.map((n) => (
                  <option key={n} value={n}>
                    {displayName(n)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Down{' '}
              <select
                value={pair[1]}
                disabled={busy}
                onChange={(e) => setPair([pair[0], e.target.value as NoteName])}
              >
                {pairPool
                  .filter((n) => pitchClass(n) !== pitchClass(pair[0]))
                  .map((n) => (
                    <option key={n} value={n}>
                      {displayName(n)}
                    </option>
                  ))}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => setPair(randomPair(pairPool))}>
              Random pair
            </button>
            <label className="check">
              <input
                type="checkbox"
                checked={withAccidentals}
                disabled={busy}
                onChange={(e) => {
                  setWithAccidentals(e.target.checked)
                  if (!e.target.checked && !pair.every(isNatural)) setPair(randomPair(NATURALS))
                }}
              />{' '}
              Include sharps and flats
            </label>
          </div>
        )}

        {exercise === 4 && (
          <div className="order">
            <ol className="order-row" aria-label="Note order">
              {order.map((n, i) => (
                <li key={n} className={i === currentRun ? 'is-current' : undefined}>
                  {displayName(n)}
                  <small aria-hidden="true">{i % 2 === 0 ? '↑' : '↓'}</small>
                </li>
              ))}
            </ol>
            <button type="button" disabled={busy} onClick={() => setOrder(shuffled(NATURALS))}>
              Shuffle
            </button>
          </div>
        )}
      </section>

      <section className="stage">
        {phase === 'confirm' ? (
          <div className="cue confirm" ref={confirmBox} tabIndex={-1} role="group" aria-labelledby={questionId}>
            <p id={questionId} className="cue-main cue-question">
              Was that clean?
            </p>
            <p className="cue-next">Every string in order, no wrong notes, no pauses.</p>
            <div className="confirm-buttons">
              <button type="button" className="primary" onClick={() => answer(true)}>
                Yes, clean
              </button>
              <button type="button" onClick={() => answer(false)}>
                No, again
              </button>
            </div>
          </div>
        ) : (
          <Cue key={running ? index : 'idle'} current={current} upcoming={upcoming} countIn={countIn} />
        )}
        <StringLadder active={current?.string ?? null} />
      </section>

      <div className="actions">
        {phase === 'idle' && (
          <button type="button" ref={startButton} className="primary" onClick={start}>
            Start
          </button>
        )}
        {running && (
          <button type="button" ref={stopButton} onClick={stop}>
            Stop
          </button>
        )}
        {step === 3 && phase === 'idle' && !progress.step3Easy && (
          <button type="button" onClick={() => dispatch({ type: 'markEasy' })}>
            This feels easy: mark step 3 done
          </button>
        )}
      </div>
    </main>
  )
}
