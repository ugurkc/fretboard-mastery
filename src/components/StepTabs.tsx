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
        // Step 0 is a study page: it is never ticked and never locked.
        const done = step !== 0 && isStepComplete(progress, step)
        const locked = step !== 0 && !isUnlocked(progress, step)
        const classes = ['step', current && 'is-current', done && 'is-done', locked && 'is-locked']
        return (
          <button
            key={step}
            type="button"
            className={classes.filter(Boolean).join(' ')}
            aria-current={current ? 'step' : undefined}
            aria-label={`Step ${step}: ${STEP_INFO[step].label}${done ? ', done' : locked ? ', locked' : ''}`}
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
