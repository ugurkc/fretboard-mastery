import { ACCIDENTALS, NATURALS, clampWindowStart } from './notes'
import type { Accidental, Natural, NoteName } from './notes'
import type { Exercise } from './sequence'

export type StepId = 1 | 2 | 3 | 4 | 5 | 6
export type TempoExercise = 2 | 3 | 4 | 5

export const STEPS: readonly StepId[] = [1, 2, 3, 4, 5, 6]
export const BASE_BPM = 40
export const TARGET_BPM = 80
export const MIN_BPM = 40
export const MAX_BPM = 160
export const BPM_STEP = 4
export const STORAGE_KEY = 'fretboard-mastery:v1'

export interface Progress {
  version: 1
  currentStep: StepId
  step1: { pass1: Natural[]; pass2: Natural[] }
  step2: Natural[]
  step3: Accidental[]
  step4Easy: boolean
  step5Clean: boolean
  /** Best tempo with a clean set, per exercise; 0 = none yet. */
  bestBpm: Record<TempoExercise, number>
  windowStart: number
  chartVisible: boolean
  /** Seconds practised, keyed by local date YYYY-MM-DD. */
  practiceSeconds: Record<string, number>
}

export type ProgressEvent =
  | { type: 'cleanSet'; exercise: Exercise; note?: NoteName; bpm: number | null }
  | { type: 'markEasy' }
  | { type: 'practiced'; date: string; seconds: number }
  | { type: 'setStep'; step: StepId }
  | { type: 'setWindowStart'; windowStart: number }
  | { type: 'toggleChart' }
  | { type: 'reset' }

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function freshProgress(): Progress {
  return {
    version: 1,
    currentStep: 1,
    step1: { pass1: [], pass2: [] },
    step2: [],
    step3: [],
    step4Easy: false,
    step5Clean: false,
    bestBpm: { 2: 0, 3: 0, 4: 0, 5: 0 },
    windowStart: 1,
    chartVisible: false,
    practiceSeconds: {},
  }
}

const isNaturalName = (n: unknown): n is Natural => (NATURALS as readonly unknown[]).includes(n)
const isAccidentalName = (n: unknown): n is Accidental => (ACCIDENTALS as readonly unknown[]).includes(n)

function addUnique<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list : [...list, item]
}

export function step1Pass(p: Progress): 1 | 2 {
  return p.step1.pass1.length < NATURALS.length ? 1 : 2
}

/** Notes already ticked off for the exercise (step 1: the current pass). */
export function doneItems(p: Progress, exercise: 1 | 2 | 3): readonly NoteName[] {
  if (exercise === 1) return step1Pass(p) === 1 ? p.step1.pass1 : p.step1.pass2
  return exercise === 2 ? p.step2 : p.step3
}

function applyCleanSet(p: Progress, e: Extract<ProgressEvent, { type: 'cleanSet' }>): Progress {
  const { exercise, note, bpm } = e
  if (exercise === 1) {
    if (!isNaturalName(note)) return p
    const key = step1Pass(p) === 1 ? 'pass1' : 'pass2'
    return { ...p, step1: { ...p.step1, [key]: addUnique(p.step1[key], note) } }
  }
  if (bpm === null || !Number.isFinite(bpm) || bpm <= 0) return p
  const next: Progress = { ...p, bestBpm: { ...p.bestBpm, [exercise]: Math.max(p.bestBpm[exercise], bpm) } }
  if (bpm < BASE_BPM) return next
  if (exercise === 2 && isNaturalName(note)) next.step2 = addUnique(p.step2, note)
  if (exercise === 3 && isAccidentalName(note)) next.step3 = addUnique(p.step3, note)
  if (exercise === 5) next.step5Clean = true
  return next
}

export function reduce(p: Progress, e: ProgressEvent): Progress {
  switch (e.type) {
    case 'cleanSet':
      return applyCleanSet(p, e)
    case 'markEasy':
      return { ...p, step4Easy: true }
    case 'practiced': {
      if (!Number.isFinite(e.seconds) || e.seconds <= 0) return p
      const total = (p.practiceSeconds[e.date] ?? 0) + e.seconds
      return { ...p, practiceSeconds: { ...p.practiceSeconds, [e.date]: total } }
    }
    case 'setStep':
      return { ...p, currentStep: e.step }
    case 'setWindowStart':
      return { ...p, windowStart: clampWindowStart(e.windowStart) }
    case 'toggleChart':
      return { ...p, chartVisible: !p.chartVisible }
    case 'reset':
      return {
        ...freshProgress(),
        windowStart: p.windowStart,
        chartVisible: p.chartVisible,
        practiceSeconds: p.practiceSeconds,
      }
  }
}

export function isStepComplete(p: Progress, step: StepId): boolean {
  switch (step) {
    case 1:
      return p.step1.pass1.length === NATURALS.length && p.step1.pass2.length === NATURALS.length
    case 2:
      return p.step2.length === NATURALS.length
    case 3:
      return p.step3.length === ACCIDENTALS.length
    case 4:
      return p.step4Easy
    case 5:
      return p.step5Clean
    case 6:
      return p.bestBpm[5] >= TARGET_BPM
  }
}

export function isUnlocked(p: Progress, step: StepId): boolean {
  return STEPS.filter((s) => s < step).every((s) => isStepComplete(p, s))
}

export function recommendedStep(p: Progress): StepId {
  return STEPS.find((s) => !isStepComplete(p, s)) ?? 6
}

export function stepProgressText(p: Progress, step: StepId): string {
  if (step !== 6 && isStepComplete(p, step)) return 'Done'
  switch (step) {
    case 1:
      return `Pass ${step1Pass(p)}: ${doneItems(p, 1).length}/${NATURALS.length} notes`
    case 2:
      return `${p.step2.length}/${NATURALS.length} notes clean at ${BASE_BPM} BPM`
    case 3:
      return `${p.step3.length}/${ACCIDENTALS.length} sharps and flats clean at ${BASE_BPM} BPM`
    case 4:
      return 'Not marked easy yet'
    case 5:
      return 'No clean pass yet'
    case 6: {
      const best = p.bestBpm[5]
      return `Best clean step-5 tempo: ${best ? `${best} BPM` : 'none yet'} (target ${TARGET_BPM} BPM)`
    }
  }
}

export function suggestNextBpm(bpm: number): number {
  return Math.min(MAX_BPM, bpm + BPM_STEP)
}

export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function secondsOn(p: Progress, date: string): number {
  return p.practiceSeconds[date] ?? 0
}

// --- storage -------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Keeps only allowed values, deduped, in canonical order. */
function pick<T>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return []
  return allowed.filter((a) => value.includes(a))
}

function bpmValue(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(MAX_BPM, Math.floor(v)) : 0
}

const SECONDS_PER_DAY = 86400

function secondsMap(v: unknown): Record<string, number> {
  if (!isRecord(v)) return {}
  const out: Record<string, number> = {}
  for (const [date, secs] of Object.entries(v)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && typeof secs === 'number' && Number.isFinite(secs) && secs >= 0 && secs <= SECONDS_PER_DAY) {
      out[date] = secs
    }
  }
  return out
}

function sanitize(raw: unknown): Progress {
  const base = freshProgress()
  if (!isRecord(raw) || raw.version !== 1) return base
  const step1 = isRecord(raw.step1) ? raw.step1 : {}
  const best = isRecord(raw.bestBpm) ? raw.bestBpm : {}
  return {
    version: 1,
    currentStep: (STEPS as readonly unknown[]).includes(raw.currentStep) ? (raw.currentStep as StepId) : base.currentStep,
    step1: { pass1: pick(step1.pass1, NATURALS), pass2: pick(step1.pass2, NATURALS) },
    step2: pick(raw.step2, NATURALS),
    step3: pick(raw.step3, ACCIDENTALS),
    step4Easy: raw.step4Easy === true,
    step5Clean: raw.step5Clean === true,
    bestBpm: { 2: bpmValue(best[2]), 3: bpmValue(best[3]), 4: bpmValue(best[4]), 5: bpmValue(best[5]) },
    windowStart: clampWindowStart(raw.windowStart),
    chartVisible: raw.chartVisible === true,
    practiceSeconds: secondsMap(raw.practiceSeconds),
  }
}

export function loadProgress(store: KeyValueStore | null): Progress {
  try {
    const raw = store?.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : freshProgress()
  } catch {
    return freshProgress()
  }
}

export function saveProgress(store: KeyValueStore | null, p: Progress): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // Storage full or blocked: the app keeps working for this visit.
  }
}

export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
