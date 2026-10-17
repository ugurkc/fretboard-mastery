import { describe, expect, it } from 'vitest'
import { ACCIDENTALS, NATURALS } from './notes'
import type { NoteName } from './notes'
import {
  MAX_BPM,
  STEPS,
  STORAGE_KEY,
  TARGET_BPM,
  doneItems,
  freshProgress,
  isStepComplete,
  isUnlocked,
  loadProgress,
  localDateKey,
  reduce,
  saveProgress,
  secondsOn,
  stepProgressText,
  suggestNextBpm,
} from './progress'
import type { Progress, ProgressEvent, StepId } from './progress'
import type { Exercise } from './sequence'

const apply = (p: Progress, events: ProgressEvent[]) => events.reduce(reduce, p)
const clean = (exercise: Exercise, notes: readonly NoteName[], bpm: number): ProgressEvent[] =>
  notes.map((note): ProgressEvent => ({ type: 'cleanSet', exercise, note, bpm }))

const throughStep = (n: number): Progress => {
  let p = freshProgress()
  if (n >= 1) p = apply(p, clean(1, NATURALS, 40))
  if (n >= 2) p = apply(p, clean(2, ACCIDENTALS, 40))
  if (n >= 3) p = reduce(p, { type: 'markEasy' })
  if (n >= 4) p = reduce(p, { type: 'cleanSet', exercise: 4, bpm: 40 })
  if (n >= 5) p = reduce(p, { type: 'cleanSet', exercise: 4, bpm: TARGET_BPM })
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

const load = (raw: unknown) => loadProgress(memoryStore(JSON.stringify(raw)))

describe('fresh progress', () => {
  it('starts on step 0 with steps 0 and 1 unlocked', () => {
    const p = freshProgress()
    expect(p.version).toBe(2)
    expect(p.currentStep).toBe(0)
    expect(isUnlocked(p, 0)).toBe(true)
    expect(isUnlocked(p, 1)).toBe(true)
    expect(isUnlocked(p, 2)).toBe(false)
  })
})

describe('step 0', () => {
  it('is complete and unlocked on fresh progress and never blocks step 1', () => {
    const p = freshProgress()
    expect(isStepComplete(p, 0)).toBe(true)
    expect(isUnlocked(p, 0)).toBe(true)
    expect(isUnlocked(p, 1)).toBe(true)
    expect(isStepComplete(p, 1)).toBe(false)
  })

  it('stays complete and unlocked whatever else is done', () => {
    for (let n = 0; n <= 5; n++) {
      expect(isStepComplete(throughStep(n), 0)).toBe(true)
      expect(isUnlocked(throughStep(n), 0)).toBe(true)
      expect(isUnlocked(throughStep(n), 1)).toBe(true)
    }
  })
})

describe('steps 1 and 2', () => {
  it('step 1 counts naturals only at 40 BPM or faster', () => {
    const p = apply(freshProgress(), [...clean(1, ['A'], 39), ...clean(1, ['B'], 40), ...clean(1, ['C#'], 40)])
    expect(p.step1).toEqual(['B'])
    expect(doneItems(p, 1)).toEqual(['B'])
  })

  it('step 1 ignores repeats and completes at seven naturals', () => {
    let p = apply(freshProgress(), clean(1, ['A', 'A'], 40))
    expect(p.step1).toEqual(['A'])
    p = apply(freshProgress(), clean(1, NATURALS.slice(0, 6), 40))
    expect(isStepComplete(p, 1)).toBe(false)
    p = apply(p, clean(1, NATURALS, 40))
    expect(p.step1).toHaveLength(7)
    expect(isStepComplete(p, 1)).toBe(true)
  })

  it('step 2 does not tick below 40 BPM', () => {
    const p = apply(freshProgress(), clean(2, ['A#'], 39))
    expect(p.step2).toEqual([])
  })

  it('step 2 counts accidentals only and completes at ten', () => {
    let p = apply(freshProgress(), clean(2, ['A', 'A#', 'A#'], 40))
    expect(p.step2).toEqual(['A#'])
    expect(doneItems(p, 2)).toEqual(['A#'])
    expect(doneItems(p, 1)).toEqual([])
    p = apply(p, clean(2, ACCIDENTALS.slice(0, 9), 40))
    expect(p.step2).toHaveLength(9)
    expect(isStepComplete(p, 2)).toBe(false)
    p = apply(p, clean(2, ACCIDENTALS, 40))
    expect(isStepComplete(p, 2)).toBe(true)
  })
})

describe('steps 3 to 5', () => {
  it('step 3 completes when marked easy', () => {
    expect(isStepComplete(freshProgress(), 3)).toBe(false)
    const p = reduce(freshProgress(), { type: 'markEasy' })
    expect(p.step3Easy).toBe(true)
    expect(isStepComplete(p, 3)).toBe(true)
  })

  it('step 4 completes with a clean pass at 40', () => {
    const p = reduce(freshProgress(), { type: 'cleanSet', exercise: 4, bpm: 40 })
    expect(p.step4Clean).toBe(true)
    expect(isStepComplete(p, 4)).toBe(true)
  })

  it('step 4 stays incomplete below 40 but records the tempo', () => {
    const p = reduce(freshProgress(), { type: 'cleanSet', exercise: 4, bpm: 39 })
    expect(isStepComplete(p, 4)).toBe(false)
    expect(p.bestBpm[4]).toBe(39)
  })

  it('ignores clean sets with a non-finite or non-positive tempo', () => {
    const before = freshProgress()
    for (const bpm of [Number.NaN, Number.POSITIVE_INFINITY, 0, -40]) {
      const p = apply(before, [
        ...clean(1, ['A'], bpm),
        ...clean(2, ['A#'], bpm),
        { type: 'cleanSet', exercise: 3, bpm },
        { type: 'cleanSet', exercise: 4, bpm },
      ])
      expect(p).toEqual(before)
    }
  })

  it('step 5 needs step 4 clean at 80', () => {
    let p = reduce(freshProgress(), { type: 'cleanSet', exercise: 4, bpm: 79 })
    expect(isStepComplete(p, 5)).toBe(false)
    p = reduce(p, { type: 'cleanSet', exercise: 4, bpm: 80 })
    expect(isStepComplete(p, 5)).toBe(true)
  })

  it('keeps the best clean tempo per exercise', () => {
    const p = apply(freshProgress(), [
      ...clean(1, ['A'], 60),
      ...clean(1, ['A'], 52),
      { type: 'cleanSet', exercise: 3, bpm: 48 },
    ])
    expect(p.bestBpm).toEqual({ 1: 60, 2: 0, 3: 48, 4: 0 })
  })
})

describe('unlocking', () => {
  it('unlocks a step only when every earlier step is complete', () => {
    const p = apply(freshProgress(), clean(2, ACCIDENTALS, 40)) // step 2 done, step 1 not
    expect(isUnlocked(p, 3)).toBe(false)
    expect(isUnlocked(throughStep(2), 3)).toBe(true)
  })

  it('keeps step 2 locked until step 1 is complete', () => {
    expect(isUnlocked(apply(freshProgress(), clean(1, NATURALS.slice(0, 6), 40)), 2)).toBe(false)
    expect(isUnlocked(throughStep(1), 2)).toBe(true)
  })

  it('opens each step in turn, and completes them all', () => {
    for (let n = 0; n < 5; n++) {
      const p = throughStep(n)
      const next = (n + 1) as StepId
      expect(isStepComplete(p, next)).toBe(false)
      expect(isUnlocked(p, next)).toBe(true)
      if (n + 2 <= 5) expect(isUnlocked(p, (n + 2) as StepId)).toBe(false)
    }
    for (const s of STEPS) {
      expect(isStepComplete(throughStep(5), s)).toBe(true)
      expect(isUnlocked(throughStep(5), s)).toBe(true)
    }
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

  it('reset clears progress but keeps settings and the practice log', () => {
    let p = apply(throughStep(4), [
      { type: 'setWindowStart', windowStart: 5 },
      { type: 'toggleChart' },
      { type: 'setStep', step: 3 },
      { type: 'practiced', date: '2026-10-17', seconds: 300 },
    ])
    p = reduce(p, { type: 'reset' })
    expect(p.currentStep).toBe(0)
    expect(p).toEqual({
      ...freshProgress(),
      windowStart: 5,
      chartVisible: true,
      practiceSeconds: { '2026-10-17': 300 },
    })
  })

  it('allows opening a locked step', () => {
    expect(reduce(freshProgress(), { type: 'setStep', step: 5 }).currentStep).toBe(5)
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
    expect(stepProgressText(freshProgress(), 0)).toBe('A study page: nothing to tick off')
    expect(stepProgressText(throughStep(5), 0)).toBe('A study page: nothing to tick off')
    expect(stepProgressText(apply(freshProgress(), clean(1, ['A', 'B'], 40)), 1)).toBe('2/7 notes clean at 40 BPM')
    expect(stepProgressText(freshProgress(), 1)).toBe('0/7 notes clean at 40 BPM')
    expect(stepProgressText(throughStep(1), 1)).toBe('Done')
    expect(stepProgressText(freshProgress(), 2)).toBe('0/10 sharps and flats clean at 40 BPM')
    expect(stepProgressText(throughStep(2), 2)).toBe('Done')
    expect(stepProgressText(freshProgress(), 3)).toBe('Not marked easy yet')
    expect(stepProgressText(throughStep(3), 3)).toBe('Done')
    expect(stepProgressText(freshProgress(), 4)).toBe('No clean pass yet')
    expect(stepProgressText(throughStep(4), 4)).toBe('Done')
    expect(stepProgressText(freshProgress(), 5)).toBe('Best clean step-4 tempo: none yet (target 80 BPM)')
    expect(stepProgressText(throughStep(4), 5)).toBe('Best clean step-4 tempo: 40 BPM (target 80 BPM)')
    expect(stepProgressText(throughStep(5), 5)).toBe('Best clean step-4 tempo: 80 BPM (target 80 BPM)')
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

  it('keeps a locked current step through save and load', () => {
    const store = memoryStore()
    saveProgress(store, { ...freshProgress(), currentStep: 5 })
    expect(loadProgress(store).currentStep).toBe(5)
  })

  it('falls back to fresh progress on corrupt JSON or an unknown version', () => {
    expect(loadProgress(memoryStore('{not json'))).toEqual(freshProgress())
    expect(load({ ...throughStep(2), version: 3 })).toEqual(freshProgress())
    expect(load({ ...throughStep(2), version: '2' })).toEqual(freshProgress())
    expect(load({ ...throughStep(2), version: undefined })).toEqual(freshProgress())
    expect(loadProgress(memoryStore('null'))).toEqual(freshProgress())
  })

  it('drops invalid entries and repairs bad fields', () => {
    const raw = {
      ...freshProgress(),
      currentStep: 6,
      step1: ['A', 'A', 'H', 'C#', 7],
      step2: ['A#', 'A', 'Bb', 'Z#', {}, 'A#'],
      step3Easy: 'true',
      step4Clean: 1,
      bestBpm: { 1: 'fast', 2: -10, 3: 52, 4: 61.6 },
      windowStart: 'x',
      chartVisible: 'yes',
      practiceSeconds: { '2026-10-17': 60, nope: 5, '2026-10-16': -1, '2026-10-15': 86401 },
    }
    expect(load(raw)).toEqual({
      ...freshProgress(),
      currentStep: 0,
      step1: ['A'],
      step2: ['A#', 'Bb'],
      bestBpm: { 1: 0, 2: 0, 3: 52, 4: 61 },
      practiceSeconds: { '2026-10-17': 60 },
    })
  })

  it('caps stored tempos and rounds them down', () => {
    const raw = { ...freshProgress(), bestBpm: { 1: 1e308, 2: 79.5, 3: 160.9, 4: 0 } }
    const p = load(raw)
    expect(p.bestBpm).toEqual({ 1: MAX_BPM, 2: 79, 3: MAX_BPM, 4: 0 })
    expect(isStepComplete({ ...p, bestBpm: { ...p.bestBpm, 4: 79 } }, 5)).toBe(false)
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

describe('migration from version 1', () => {
  const v1 = {
    version: 1,
    currentStep: 4,
    step1: { pass1: [...NATURALS], pass2: ['C', 'D'] },
    step2: ['C', 'E', 'G'],
    step3: ['C#', 'Bb'],
    step4Easy: true,
    step5Clean: false,
    bestBpm: { 2: 52, 3: 48, 4: 44, 5: 64 },
    windowStart: 5,
    chartVisible: true,
    practiceSeconds: { '2026-10-16': 600, '2026-10-17': 90 },
  }

  it('maps every field to the new numbering and drops the old step 1', () => {
    expect(load(v1)).toEqual({
      version: 2,
      currentStep: 3,
      step1: ['C', 'E', 'G'],
      step2: ['C#', 'Bb'],
      step3Easy: true,
      step4Clean: false,
      bestBpm: { 1: 52, 2: 48, 3: 44, 4: 64 },
      windowStart: 5,
      chartVisible: true,
      practiceSeconds: { '2026-10-16': 600, '2026-10-17': 90 },
    })
    const flags = load({ ...v1, step4Easy: false, step5Clean: true })
    expect(flags.step3Easy).toBe(false)
    expect(flags.step4Clean).toBe(true)
  })

  it('moves the current step down one, with old step 1 going to step 0', () => {
    const expected: Record<number, StepId> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 }
    for (const [old, now] of Object.entries(expected)) {
      expect(load({ ...v1, currentStep: Number(old) }).currentStep).toBe(now)
    }
    expect(load({ ...v1, currentStep: 7 }).currentStep).toBe(0)
    expect(load({ ...v1, currentStep: '3' }).currentStep).toBe(0)
  })

  it('keeps migrated progress meaning the same thing', () => {
    const done = load({ ...v1, step2: [...NATURALS], step3: [...ACCIDENTALS], step5Clean: true, bestBpm: { 5: 80 } })
    for (const s of STEPS) expect(isStepComplete(done, s)).toBe(true)
  })

  it('saves back as version 2 and round-trips', () => {
    const store = memoryStore(JSON.stringify(v1))
    const p = loadProgress(store)
    saveProgress(store, p)
    expect(JSON.parse(store.data.get(STORAGE_KEY) ?? 'null').version).toBe(2)
    expect(loadProgress(store)).toEqual(p)
  })

  it('still sanitizes a version-1 record full of junk', () => {
    const raw = {
      version: 1,
      currentStep: 'two',
      step1: 'nope',
      step2: ['A', 'A', 'H', 'C#', 7],
      step3: ['A#', 'A', 'Bb', 'Z#', {}, 'A#'],
      step4Easy: 'true',
      step5Clean: 1,
      bestBpm: { 1: 99, 2: 'fast', 3: -10, 4: 52.9, 5: 1e308 },
      windowStart: 42,
      chartVisible: 'yes',
      practiceSeconds: { '2026-10-17': 60, nope: 5, '2026-10-16': -1, '2026-10-15': 86401 },
      extra: 'ignored',
    }
    expect(load(raw)).toEqual({
      version: 2,
      currentStep: 0,
      step1: ['A'],
      step2: ['A#', 'Bb'],
      step3Easy: false,
      step4Clean: false,
      bestBpm: { 1: 0, 2: 0, 3: 52, 4: MAX_BPM },
      windowStart: 10,
      chartVisible: false,
      practiceSeconds: { '2026-10-17': 60 },
    })
    expect(load({ version: 1 })).toEqual(freshProgress())
    expect(load({ ...v1, bestBpm: null }).bestBpm).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 })
  })
})
