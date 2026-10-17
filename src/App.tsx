import { useEffect, useReducer } from 'react'
import { FretChart } from './components/FretChart'
import { PositionsScreen } from './components/PositionsScreen'
import { PracticeScreen } from './components/PracticeScreen'
import { StepTabs } from './components/StepTabs'
import { formatDuration } from './lib/format'
import { MAX_WINDOW_START, MIN_WINDOW_START, WINDOW_SIZE } from './lib/notes'
import {
  browserStore,
  isUnlocked,
  loadProgress,
  localDateKey,
  reduce,
  saveProgress,
  secondsOn,
} from './lib/progress'
import type { StepId } from './lib/progress'

const store = browserStore()
const DAILY_GOAL_SECONDS = 5 * 60
const WINDOW_STARTS = Array.from(
  { length: MAX_WINDOW_START - MIN_WINDOW_START + 1 },
  (_, i) => MIN_WINDOW_START + i,
)

export default function App() {
  const [progress, dispatch] = useReducer(reduce, null, () => loadProgress(store))

  useEffect(() => {
    saveProgress(store, progress)
  }, [progress])

  function openStep(step: StepId) {
    if (step === progress.currentStep) return
    if (
      !isUnlocked(progress, step) &&
      !window.confirm(
        'The method works best when the steps are done in order, even the easy ones. Open this step anyway?',
      )
    ) {
      return
    }
    dispatch({ type: 'setStep', step })
  }

  function resetAll() {
    if (window.confirm('Reset all progress? Your ticks and best tempos will be cleared.')) {
      dispatch({ type: 'reset' })
    }
  }

  const today = secondsOn(progress, localDateKey(new Date()))
  const { currentStep } = progress

  return (
    <div className="app">
      <header className="top">
        <h1>Fretboard Mastery</h1>
        <p className={today >= DAILY_GOAL_SECONDS ? 'today is-met' : 'today'}>
          Practised today: {formatDuration(today)} <span className="muted">/ 5m</span>
        </p>
      </header>

      <StepTabs progress={progress} onOpen={openStep} />

      {currentStep === 0 ? (
        <PositionsScreen
          windowStart={progress.windowStart}
          onStartPractice={() => dispatch({ type: 'setStep', step: 1 })}
        />
      ) : (
        <PracticeScreen key={currentStep} step={currentStep} progress={progress} dispatch={dispatch} />
      )}

      <section className="reference">
        <div className="reference-bar">
          {/* Step 0 has its own chart, so the reference chart and its toggle are hidden there. */}
          {currentStep !== 0 && (
            <button type="button" onClick={() => dispatch({ type: 'toggleChart' })} aria-expanded={progress.chartVisible}>
              {progress.chartVisible ? 'Hide note chart' : 'Show note chart'}
            </button>
          )}
          <label>
            Frets{' '}
            <select
              value={progress.windowStart}
              onChange={(e) => dispatch({ type: 'setWindowStart', windowStart: Number(e.target.value) })}
            >
              {WINDOW_STARTS.map((s) => (
                <option key={s} value={s}>
                  {s}–{s + WINDOW_SIZE - 1}
                </option>
              ))}
            </select>
          </label>
        </div>
        {currentStep !== 0 && progress.chartVisible && <FretChart windowStart={progress.windowStart} />}
      </section>

      <footer className="foot">
        <p>Thanks to Bahadır Peker for introducing me to this method.</p>
        <button type="button" className="link" onClick={resetAll}>
          Reset progress
        </button>
      </footer>
    </div>
  )
}
