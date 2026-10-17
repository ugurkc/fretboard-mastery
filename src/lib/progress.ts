import { ACCIDENTALS, NATURALS, clampWindowStart } from './notes'
import type { Accidental, Natural, NoteName } from './notes'
import type { Exercise } from './sequence'

/** Step 0 is the positions study page; steps 1 to 5 are practice. */
export type StepId = 0 | 1 | 2 | 3 | 4 | 5
export type PracticeStep = Exclude<StepId, 0>

export const STEPS: readonly StepId[] = [0, 1, 2, 3, 4, 5]
export const BASE_BPM = 40
export const TARGET_BPM = 80
export const MIN_BPM = 40
export const MAX_BPM = 160
export const BPM_STEP = 4
/** The key stays "v1" across data versions; the `version` field inside says which. */
export const STORAGE_KEY = 'fretboard-mastery:v1'

export interface Progress {
  version: 2
  currentStep: StepId
  step1: Natural[]
  step2: Accidental[]
  step3Easy: boolean
  step4Clean: boolean
  /** Best tempo with a clean set, per exercise; 0 = none yet. */
  bestBpm: Record<Exercise, number>
  windowStart: number
  chartVisible: boolean
  /** Seconds practised, keyed by local date YYYY-MM-DD. */
  practiceSeconds: Record<string, number>
}

export type ProgressEvent =
  | { type: 'cleanSet'; exercise: Exercise; note?: NoteName; bpm: number }
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
    version: 2,
    currentStep: 0,
    step1: [],
    step2: [],
    step3Easy: false,
    step4Clean: false,
    bestBpm: { 1: 0, 2: 0, 3: 0, 4: 0 },
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

/** Notes already ticked off for the exercise. */
export function doneItems(p: Progress, exercise: 1 | 2): readonly NoteName[] {
  return exercise === 1 ? p.step1 : p.step2
}

function applyCleanSet(p: Progress, e: Extract<ProgressEvent, { type: 'cleanSet' }>): Progress {
  const { exercise, note, bpm } = e
  if (!Number.isFinite(bpm) || bpm <= 0) return p
  const next: Progress = { ...p, bestBpm: { ...p.bestBpm, [exercise]: Math.max(p.bestBpm[exercise], bpm) } }
  if (bpm < BASE_BPM) return next
  if (exercise === 1 && isNaturalName(note)) next.step1 = addUnique(p.step1, note)
  if (exercise === 2 && isAccidentalName(note)) next.step2 = addUnique(p.step2, note)
  if (exercise === 4) next.step4Clean = true
  return next
}

export function reduce(p: Progress, e: ProgressEvent): Progress {
  switch (e.type) {
    case 'cleanSet':
      return applyCleanSet(p, e)
    case 'markEasy':
      return { ...p, step3Easy: true }
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
    case 0:
      return true
    case 1:
      return p.step1.length === NATURALS.length
    case 2:
      return p.step2.length === ACCIDENTALS.length
    case 3:
      return p.step3Easy
    case 4:
      return p.step4Clean
    case 5:
      return p.bestBpm[4] >= TARGET_BPM
  }
}

/** Step 0 never gates: a step opens when every practice step before it is complete. */
export function isUnlocked(p: Progress, step: StepId): boolean {
  return STEPS.filter((s) => s > 0 && s < step).every((s) => isStepComplete(p, s))
}

export function stepProgressText(p: Progress, step: StepId): string {
  if (step !== 0 && step !== 5 && isStepComplete(p, step)) return 'Done'
  switch (step) {
    case 0:
      return 'A study page: nothing to tick off'
    case 1:
      return `${p.step1.length}/${NATURALS.length} notes clean at ${BASE_BPM} BPM`
    case 2:
      return `${p.step2.length}/${ACCIDENTALS.length} sharps and flats clean at ${BASE_BPM} BPM`
    case 3:
      return 'Not marked easy yet'
    case 4:
      return 'No clean pass yet'
    case 5: {
      const best = p.bestBpm[4]
      return `Best clean step-4 tempo: ${best ? `${best} BPM` : 'none yet'} (target ${TARGET_BPM} BPM)`
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

/**
 * Version 1 had a self-paced step 1 and steps 2-6. Its step 1 (pass1/pass2) is dropped; steps
 * 2-6 become 1-5, with old step 1 landing on the new step 0. The result is still unchecked:
 * sanitize validates it like any version-2 record.
 */
function migrateV1(raw: Record<string, unknown>): Record<string, unknown> {
  const best = isRecord(raw.bestBpm) ? raw.bestBpm : {}
  const step = raw.currentStep
  return {
    version: 2,
    currentStep: typeof step === 'number' ? Math.max(0, step - 1) : step,
    step1: raw.step2,
    step2: raw.step3,
    step3Easy: raw.step4Easy,
    step4Clean: raw.step5Clean,
    bestBpm: { 1: best[2], 2: best[3], 3: best[4], 4: best[5] },
    windowStart: raw.windowStart,
    chartVisible: raw.chartVisible,
    practiceSeconds: raw.practiceSeconds,
  }
}

function sanitize(stored: unknown): Progress {
  const base = freshProgress()
  if (!isRecord(stored)) return base
  const raw = stored.version === 1 ? migrateV1(stored) : stored
  if (raw.version !== 2) return base
  const best = isRecord(raw.bestBpm) ? raw.bestBpm : {}
  return {
    version: 2,
    currentStep: (STEPS as readonly unknown[]).includes(raw.currentStep) ? (raw.currentStep as StepId) : base.currentStep,
    step1: pick(raw.step1, NATURALS),
    step2: pick(raw.step2, ACCIDENTALS),
    step3Easy: raw.step3Easy === true,
    step4Clean: raw.step4Clean === true,
    bestBpm: { 1: bpmValue(best[1]), 2: bpmValue(best[2]), 3: bpmValue(best[3]), 4: bpmValue(best[4]) },
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
