import { describe, expect, it } from 'vitest'
import { ACCIDENTALS, NATURALS } from './notes'
import type { NoteName } from './notes'
import {
  STEPS,
  STORAGE_KEY,
  TARGET_BPM,
  doneItems,
  freshProgress,
  isStepComplete,
  isUnlocked,
  loadProgress,
  localDateKey,
  recommendedStep,
  reduce,
  saveProgress,
  secondsOn,
  step1Pass,
  stepProgressText,
  suggestNextBpm,
} from './progress'
import type { Progress, ProgressEvent } from './progress'
import type { Exercise } from './sequence'

const apply = (p: Progress, events: ProgressEvent[]) => events.reduce(reduce, p)
const clean = (exercise: Exercise, notes: readonly NoteName[], bpm: number | null): ProgressEvent[] =>
  notes.map((note): ProgressEvent => ({ type: 'cleanSet', exercise, note, bpm }))

const step1Done = (p: Progress) => apply(p, [...clean(1, NATURALS, null), ...clean(1, NATURALS, null)])
const throughStep = (n: number): Progress => {
  let p = freshProgress()
  if (n >= 1) p = step1Done(p)
  if (n >= 2) p = apply(p, clean(2, NATURALS, 40))
  if (n >= 3) p = apply(p, clean(3, ACCIDENTALS, 40))
  if (n >= 4) p = reduce(p, { type: 'markEasy' })
  if (n >= 5) p = reduce(p, { type: 'cleanSet', exercise: 5, bpm: 40 })
  if (n >= 6) p = reduce(p, { type: 'cleanSet', exercise: 5, bpm: TARGET_BPM })
  return p
}

function memoryStore(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(STORAGE_KEY, initial)
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

describe('fresh progress', () => {
  it('starts on step 1 with only step 1 unlocked', () => {
    const p = freshProgress()
    expect(p.currentStep).toBe(1)
    expect(isUnlocked(p, 1)).toBe(true)
    expect(isUnlocked(p, 2)).toBe(false)
    expect(recommendedStep(p)).toBe(1)
  })
})

describe('step 1', () => {
  it('fills pass 1, then pass 2, and completes after both', () => {
    let p = apply(freshProgress(), clean(1, NATURALS, null))
    expect(p.step1.pass1).toHaveLength(7)
    expect(step1Pass(p)).toBe(2)
    expect(doneItems(p, 1)).toEqual([])
    expect(isStepComplete(p, 1)).toBe(false)
    p = apply(p, clean(1, NATURALS, null))
    expect(isStepComplete(p, 1)).toBe(true)
  })

  it('ignores repeats and accidentals', () => {
    const p = apply(freshProgress(), [...clean(1, ['A', 'A'], null), ...clean(1, ['A#'], null)])
    expect(p.step1.pass1).toEqual(['A'])
  })
})

describe('steps 2 and 3', () => {
  it('step 2 counts naturals only at 40 BPM or faster', () => {
    const p = apply(freshProgress(), [...clean(2, ['A'], 36), ...clean(2, ['B'], 40), ...clean(2, ['C#'], 40)])
    expect(p.step2).toEqual(['B'])
  })

  it('step 3 counts accidentals only and completes at ten', () => {
    let p = apply(freshProgress(), clean(3, ['A', 'A#'], 40))
    expect(p.step3).toEqual(['A#'])
    p = apply(p, clean(3, ACCIDENTALS, 40))
    expect(isStepComplete(p, 3)).toBe(true)
  })
})

describe('steps 4 to 6', () => {
  it('step 4 completes when marked easy', () => {
    expect(isStepComplete(reduce(freshProgress(), { type: 'markEasy' }), 4)).toBe(true)
  })

  it('step 5 completes with a clean pass at 40', () => {
    const p = reduce(freshProgress(), { type: 'cleanSet', exercise: 5, bpm: 40 })
    expect(isStepComplete(p, 5)).toBe(true)
  })

  it('step 6 needs step 5 clean at 80', () => {
    let p = reduce(freshProgress(), { type: 'cleanSet', exercise: 5, bpm: 76 })
    expect(isStepComplete(p, 6)).toBe(false)
    p = reduce(p, { type: 'cleanSet', exercise: 5, bpm: 80 })
    expect(isStepComplete(p, 6)).toBe(true)
  })

  it('keeps the best clean tempo per exercise', () => {
    const p = apply(freshProgress(), [
      ...clean(2, ['A'], 60),
      ...clean(2, ['A'], 52),
      { type: 'cleanSet', exercise: 4, bpm: 48 },
    ])
    expect(p.bestBpm[2]).toBe(60)
    expect(p.bestBpm[4]).toBe(48)
    expect(p.bestBpm[3]).toBe(0)
  })
})

describe('unlocking', () => {
  it('unlocks a step only when every earlier step is complete', () => {
    const p = apply(freshProgress(), clean(2, NATURALS, 40)) // step 2 done, step 1 not
    expect(isUnlocked(p, 3)).toBe(false)
    expect(isUnlocked(throughStep(2), 3)).toBe(true)
  })

  it('recommends the first incomplete step, or 6 when all are done', () => {
    expect(recommendedStep(throughStep(2))).toBe(3)
    expect(recommendedStep(throughStep(6))).toBe(6)
    for (const s of STEPS) expect(isStepComplete(throughStep(6), s)).toBe(true)
  })
})

describe('settings and time', () => {
  it('accumulates practice seconds per day and ignores bad values', () => {
    const p = apply(freshProgress(), [
      { type: 'practiced', date: '2026-10-17', seconds: 90 },
      { type: 'practiced', date: '2026-10-17', seconds: 30.4 },
      { type: 'practiced', date: '2026-10-17', seconds: -5 },
      { type: 'practiced', date: '2026-10-17', seconds: Number.NaN },
    ])
    expect(secondsOn(p, '2026-10-17')).toBeCloseTo(120.4)
    expect(secondsOn(p, '2026-10-18')).toBe(0)
  })

  it('clamps the window start and toggles the chart', () => {
    let p = reduce(freshProgress(), { type: 'setWindowStart', windowStart: 42 })
    expect(p.windowStart).toBe(10)
    p = reduce(p, { type: 'toggleChart' })
    expect(p.chartVisible).toBe(true)
  })

  it('reset clears progress but keeps settings', () => {
    let p = apply(throughStep(3), [
      { type: 'setWindowStart', windowStart: 5 },
      { type: 'toggleChart' },
    ])
    p = reduce(p, { type: 'reset' })
    expect(isStepComplete(p, 1)).toBe(false)
    expect(p.windowStart).toBe(5)
    expect(p.chartVisible).toBe(true)
  })
})

describe('helpers', () => {
  it('suggests +4 BPM, capped', () => {
    expect(suggestNextBpm(40)).toBe(44)
    expect(suggestNextBpm(158)).toBe(160)
  })

  it('formats local dates', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })

  it('describes step progress', () => {
    expect(stepProgressText(apply(freshProgress(), clean(1, ['A', 'B'], null)), 1)).toBe('Pass 1: 2/7 notes')
    expect(stepProgressText(throughStep(1), 1)).toBe('Done')
    expect(stepProgressText(freshProgress(), 6)).toBe('Best clean step-5 tempo: none yet (target 80 BPM)')
  })
})

describe('storage', () => {
  it('returns fresh progress when nothing is stored', () => {
    expect(loadProgress(memoryStore())).toEqual(freshProgress())
    expect(loadProgress(null)).toEqual(freshProgress())
  })

  it('round-trips through save and load', () => {
    const store = memoryStore()
    const p = throughStep(3)
    saveProgress(store, p)
    expect(loadProgress(store)).toEqual(p)
  })

  it('falls back to fresh progress on corrupt JSON or an unknown version', () => {
    expect(loadProgress(memoryStore('{not json'))).toEqual(freshProgress())
    expect(loadProgress(memoryStore(JSON.stringify({ ...throughStep(2), version: 2 })))).toEqual(freshProgress())
    expect(loadProgress(memoryStore('null'))).toEqual(freshProgress())
  })

  it('drops invalid entries and repairs bad fields', () => {
    const raw = {
      ...freshProgress(),
      currentStep: 9,
      step2: ['A', 'A', 'H', 'C#', 7],
      bestBpm: { 2: 'fast', 3: -10, 4: 52, 5: 61.6 },
      windowStart: 'x',
      practiceSeconds: { '2026-10-17': 60, nope: 5, '2026-10-16': -1 },
    }
    const p = loadProgress(memoryStore(JSON.stringify(raw)))
    expect(p.currentStep).toBe(1)
    expect(p.step2).toEqual(['A'])
    expect(p.bestBpm).toEqual({ 2: 0, 3: 0, 4: 52, 5: 62 })
    expect(p.windowStart).toBe(1)
    expect(p.practiceSeconds).toEqual({ '2026-10-17': 60 })
  })

  it('never throws when storage itself throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(loadProgress(broken)).toEqual(freshProgress())
    expect(() => saveProgress(broken, freshProgress())).not.toThrow()
  })
})
