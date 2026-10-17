import { STEPS, isStepComplete, isUnlocked } from '../lib/progress'
import type { Progress, StepId } from '../lib/progress'
import { STEP_INFO } from '../lib/steps'

interface Props {
  progress: Progress
  onOpen: (step: StepId) => void
}

export function StepTabs({ progress, onOpen }: Props) {
  return (
    <nav className="steps" aria-label="Steps">
      {STEPS.map((step) => {
        const current = step === progress.currentStep
        const done = isStepComplete(progress, step)
        const locked = !isUnlocked(progress, step)
        const classes = ['step', current && 'is-current', done && 'is-done', locked && 'is-locked']
        return (
          <button
            key={step}
            type="button"
            className={classes.filter(Boolean).join(' ')}
            aria-current={current ? 'step' : undefined}
            onClick={() => onOpen(step)}
          >
            <span className="step-num">{done ? '✓' : step}</span>
            <span className="step-label">{STEP_INFO[step].label}</span>
          </button>
        )
      })}
    </nav>
  )
}
