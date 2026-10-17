import { useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import { ACCIDENTALS, NATURALS, displayName } from '../lib/notes'
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
import type { Progress, ProgressEvent, StepId, TempoExercise } from '../lib/progress'
import { STEP_INFO } from '../lib/steps'
import { Metronome } from '../lib/metronome'
import { Cue } from './Cue'
import { StringLadder } from './StringLadder'

const COUNT_IN = 4
const DRILLS: readonly TempoExercise[] = [2, 3, 4, 5]

type Phase = 'idle' | 'running' | 'confirm'

interface Props {
  step: StepId
  progress: Progress
  dispatch: Dispatch<ProgressEvent>
}

export function PracticeScreen({ step, progress, dispatch }: Props) {
  const [drill, setDrill] = useState<TempoExercise>(2)
  const exercise: Exercise = step === 6 ? drill : step
  const [bpm, setBpm] = useState(BASE_BPM)
  const tempo = step === 6 ? bpm : BASE_BPM

  const [chosenNote, setChosenNote] = useState<NoteName | null>(null)
  const [withAccidentals, setWithAccidentals] = useState(false)
  const [pair, setPair] = useState<[NoteName, NoteName]>(() => randomPair(NATURALS))
  const [order, setOrder] = useState<NoteName[]>(() => shuffled(NATURALS))

  const [phase, setPhase] = useState<Phase>('idle')
  const [index, setIndex] = useState(0)
  const metronome = useRef<Metronome | null>(null)
  const startedAt = useRef<number | null>(null)
  const nextButton = useRef<HTMLButtonElement>(null)

  const pool: readonly NoteName[] = exercise === 3 ? ACCIDENTALS : NATURALS
  const done: readonly NoteName[] =
    exercise === 1 || exercise === 2 || exercise === 3 ? doneItems(progress, exercise) : []
  const note =
    chosenNote && pool.includes(chosenNote) ? chosenNote : (pool.find((n) => !done.includes(n)) ?? pool[0])
  const pairPool: readonly NoteName[] = withAccidentals ? [...NATURALS, ...ACCIDENTALS] : NATURALS

  const config: SetConfig =
    exercise === 4 ? { exercise, pair } : exercise === 5 ? { exercise, order } : { exercise, note }
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
    if (exercise === 1) {
      setIndex(0)
      return
    }
    setIndex(-COUNT_IN)
    metronome.current ??= new Metronome()
    metronome.current.start({
      bpm: tempo,
      countIn: COUNT_IN,
      totalBeats: beats.length,
      isAccent: (i) => i % BEATS_PER_RUN === 0,
      onBeat: setIndex,
      onDone: finish,
    })
  }

  function stop() {
    metronome.current?.stop()
    logPractice()
    setPhase('idle')
  }

  function advance() {
    if (index + 1 >= beats.length) finish()
    else setIndex(index + 1)
  }

  function answer(clean: boolean) {
    setPhase('idle')
    if (!clean) return
    dispatch({
      type: 'cleanSet',
      exercise,
      note: exercise <= 3 ? note : undefined,
      bpm: exercise === 1 ? null : tempo,
    })
    if (step !== 6) setChosenNote(null) // move on to the next unticked note
    if (exercise === 5) setOrder(shuffled(NATURALS))
    if (step === 6) setBpm(suggestNextBpm(tempo))
  }

  // Step 1: Space advances. A focused button handles Space itself, so skip those.
  useEffect(() => {
    if (!running || exercise !== 1) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.target instanceof HTMLButtonElement) return
      e.preventDefault()
      advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (running && exercise === 1) nextButton.current?.focus()
  }, [running, exercise])

  // Leaving the step (the parent remounts us per step) stops the click and keeps the time.
  useEffect(
    () => () => {
      metronome.current?.stop()
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
        <h2>
          Step {step}: {info.label}
        </h2>
        <p>{info.instructions}</p>
        <p className="goal">
          <strong>Goal:</strong> {info.goal}
        </p>
        <p className="status">
          {stepProgressText(progress, step)}
          {exercise !== 1 && step !== 6 && <> · Tempo {BASE_BPM} BPM</>}
        </p>
      </section>

      <section className="controls">
        {step === 6 && (
          <div className="drill">
            <div className="picker" role="group" aria-label="Exercise">
              {DRILLS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={d === drill ? 'chip is-selected' : 'chip'}
                  aria-pressed={d === drill}
                  disabled={busy}
                  onClick={() => setDrill(d)}
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

        {exercise <= 3 && (
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

        {exercise === 4 && (
          <div className="pair">
            <label>
              Up{' '}
              <select
                value={pair[0]}
                disabled={busy}
                onChange={(e) => setPair([e.target.value as NoteName, pair[1]])}
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
                {pairPool.map((n) => (
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
                  if (!e.target.checked) setPair(randomPair(NATURALS))
                }}
              />{' '}
              Include sharps and flats
            </label>
          </div>
        )}

        {exercise === 5 && (
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
          <div className="cue confirm">
            <p className="cue-main cue-question">Was that clean?</p>
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
          <button type="button" className="primary" onClick={start}>
            Start
          </button>
        )}
        {running && exercise === 1 && (
          <button type="button" ref={nextButton} className="primary" onClick={advance}>
            Next string
          </button>
        )}
        {running && (
          <button type="button" onClick={stop}>
            Stop
          </button>
        )}
        {step === 4 && phase === 'idle' && !progress.step4Easy && (
          <button type="button" onClick={() => dispatch({ type: 'markEasy' })}>
            This feels easy: mark step 4 done
          </button>
        )}
      </div>
    </main>
  )
}
