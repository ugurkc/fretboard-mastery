import { useEffect, useReducer, useState } from 'react'
import { FretChart } from './components/FretChart'
import { FretWindowSelect } from './components/FretWindowSelect'
import { PositionsScreen } from './components/PositionsScreen'
import { PracticeScreen } from './components/PracticeScreen'
import { StepTabs } from './components/StepTabs'
import { formatDuration } from './lib/format'
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

export default function App() {
  const [progress, dispatch] = useReducer(reduce, null, () => loadProgress(store))
  // True only right after "Start step 1", so that one step change moves focus to the new heading.
  const [focusPractice, setFocusPractice] = useState(false)

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
    setFocusPractice(false)
    dispatch({ type: 'setStep', step })
  }

  function startPractice() {
    setFocusPractice(true)
    dispatch({ type: 'setStep', step: 1 })
  }

  function setWindowStart(windowStart: number) {
    dispatch({ type: 'setWindowStart', windowStart })
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
          onWindowChange={setWindowStart}
          onStartPractice={startPractice}
        />
      ) : (
        <PracticeScreen
          key={currentStep}
          step={currentStep}
          progress={progress}
          dispatch={dispatch}
          focusHeading={focusPractice}
        />
      )}

      {/* Step 0 has its own chart and fret selector, so the reference bar is for steps 1–5. */}
      {currentStep !== 0 && (
        <section className="reference">
          <div className="reference-bar">
            <button type="button" onClick={() => dispatch({ type: 'toggleChart' })} aria-expanded={progress.chartVisible}>
              {progress.chartVisible ? 'Hide note chart' : 'Show note chart'}
            </button>
            <FretWindowSelect windowStart={progress.windowStart} onChange={setWindowStart} />
          </div>
          {progress.chartVisible && <FretChart windowStart={progress.windowStart} />}
        </section>
      )}

      <footer className="foot">
        <p>Thanks to Bahadır Peker for introducing me to this method.</p>
        <button type="button" className="link" onClick={resetAll}>
          Reset progress
        </button>
      </footer>
    </div>
  )
}
