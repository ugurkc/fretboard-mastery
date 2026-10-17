import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Metronome, beatsInWindow, type MetronomeRun } from './metronome'

describe('beatsInWindow', () => {
  it('lists beat times from nextTime up to (not including) the horizon', () => {
    expect(beatsInWindow(1, 2.6, 0.5)).toEqual([1, 1.5, 2, 2.5])
    expect(beatsInWindow(1, 1.25, 0.5)).toEqual([1])
  })

  it('returns nothing when the next beat is past the horizon', () => {
    expect(beatsInWindow(3, 2.9, 0.5)).toEqual([])
  })
})

describe('beatsInWindow with a bad beat length', () => {
  it('returns nothing for non-finite beat lengths', () => {
    expect(beatsInWindow(1, 2, Number.NaN)).toEqual([])
    expect(beatsInWindow(1, 2, Number.POSITIVE_INFINITY)).toEqual([])
  })

  it('returns nothing for zero or negative beat lengths', () => {
    expect(beatsInWindow(1, 2, 0)).toEqual([])
    expect(beatsInWindow(1, 2, -1)).toEqual([])
  })
})

// A minimal stand-in for Web Audio. Its clock is the fake Date.now(), so
// vi.advanceTimersByTime moves audio time and fires timers together.
class FakeNode {
  connections: unknown[] = []
  disconnected = false
  connect<T>(target: T): T {
    this.connections.push(target)
    return target
  }
  disconnect(): void {
    this.disconnected = true
  }
}

class FakeParam {
  value = 0
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam()
}

class FakeOscillator extends FakeNode {
  frequency = new FakeParam()
  startTime: number | null = null
  start(time: number): void {
    this.startTime = time
  }
  stop(): void {}
}

class FakeAudioContext {
  static latency = { outputLatency: 0, baseLatency: 0 }
  static instances: FakeAudioContext[] = []
  readonly destination = new FakeNode()
  outputLatency = FakeAudioContext.latency.outputLatency
  baseLatency = FakeAudioContext.latency.baseLatency
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  private readonly t0 = Date.now()

  constructor() {
    FakeAudioContext.instances.push(this)
  }
  get currentTime(): number {
    return (Date.now() - this.t0) / 1000
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc
  }
  createGain(): FakeGain {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }
  /** Gain nodes wired straight to the speakers: one per run. */
  outputs(): FakeGain[] {
    return this.gains.filter((g) => g.connections.includes(this.destination))
  }
}

interface Recorded {
  run: MetronomeRun
  beats: { index: number; at: number }[]
  done: number[]
}

/** A run at 120 bpm (0.5 s per beat) that records when its callbacks fire, in seconds. */
function recordRun(overrides: Partial<MetronomeRun> = {}): Recorded {
  const t0 = Date.now()
  const rec: Recorded = {
    beats: [],
    done: [],
    run: {
      bpm: 120,
      countIn: 4,
      totalBeats: 6,
      isAccent: (i) => i % 6 === 0,
      onBeat: (index) => rec.beats.push({ index, at: (Date.now() - t0) / 1000 }),
      onDone: () => rec.done.push((Date.now() - t0) / 1000),
      ...overrides,
    },
  }
  return rec
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => from + i)
}

describe('Metronome', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeAudioContext.latency = { outputLatency: 0, baseLatency: 0 }
    FakeAudioContext.instances = []
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  const ctx = () => FakeAudioContext.instances[0]
  const clickTimes = () => ctx().oscillators.map((o) => o.startTime ?? Number.NaN)

  it('clicks count-in plus run, cues each beat on its click, and finishes once a beat later', () => {
    const rec = recordRun()
    new Metronome().start(rec.run)
    vi.advanceTimersByTime(10_000)

    expect(ctx().oscillators).toHaveLength(4 + 6)
    expect(rec.beats.map((b) => b.index)).toEqual(range(-4, 6))
    // The first click comes after the start delay; then one every 0.5 s.
    const clicks = clickTimes()
    clicks.forEach((t, i) => expect(t).toBeCloseTo(0.1 + 0.5 * i, 6))
    rec.beats.forEach((b, i) => expect(b.at).toBeCloseTo(clicks[i], 2))
    expect(rec.done).toHaveLength(1)
    expect(rec.done[0]).toBeCloseTo(clicks[clicks.length - 1] + 0.5, 2)
  })

  it('accents mark the runs and count-in clicks have their own pitch', () => {
    const rec = recordRun({ countIn: 1, totalBeats: 7 })
    new Metronome().start(rec.run)
    vi.advanceTimersByTime(10_000)
    expect(ctx().oscillators.map((o) => o.frequency.value)).toEqual([800, 1500, 1000, 1000, 1000, 1000, 1000, 1500])
  })

  it('stop() mid-run silences the run and cancels the remaining cues', () => {
    const rec = recordRun()
    const m = new Metronome()
    m.start(rec.run)
    vi.advanceTimersByTime(1_300)
    const seen = rec.beats.length
    m.stop()
    vi.advanceTimersByTime(10_000)

    expect(seen).toBeGreaterThan(0)
    expect(rec.beats).toHaveLength(seen)
    expect(rec.done).toEqual([])
    const outs = ctx().outputs()
    expect(outs).toHaveLength(1)
    expect(outs[0].disconnected).toBe(true)
    // Every click of the run went through that output.
    for (const osc of ctx().oscillators) expect((osc.connections[0] as FakeGain).connections).toEqual([outs[0]])
  })

  it('start() while running replaces the old run cleanly', () => {
    const first = recordRun()
    const m = new Metronome()
    m.start(first.run)
    vi.advanceTimersByTime(1_300)
    const seen = first.beats.length
    const second = recordRun({ countIn: 2, totalBeats: 3 })
    m.start(second.run)
    const [oldOut, newOut] = ctx().outputs()
    expect(oldOut.disconnected).toBe(true)
    expect(newOut.disconnected).toBe(false)
    vi.advanceTimersByTime(10_000)

    expect(first.beats).toHaveLength(seen)
    expect(first.done).toEqual([])
    expect(second.beats.map((b) => b.index)).toEqual(range(-2, 3))
    expect(second.done).toHaveLength(1)
    expect(FakeAudioContext.instances).toHaveLength(1)
    // The finished run's own stop() released its output too.
    expect(newOut.disconnected).toBe(true)
  })

  it.each([
    ['zero bpm', { bpm: 0 }],
    ['negative bpm', { bpm: -60 }],
    ['NaN bpm', { bpm: Number.NaN }],
    ['infinite bpm', { bpm: Number.POSITIVE_INFINITY }],
    ['fractional count-in', { countIn: 1.5 }],
    ['negative count-in', { countIn: -1 }],
    ['fractional total', { totalBeats: 2.5 }],
    ['negative total', { totalBeats: -1 }],
    ['NaN total', { totalBeats: Number.NaN }],
  ])('schedules nothing for %s', (_, overrides: Partial<MetronomeRun>) => {
    const rec = recordRun(overrides)
    new Metronome().start(rec.run)
    vi.advanceTimersByTime(10_000)
    expect(FakeAudioContext.instances.flatMap((c) => c.oscillators)).toEqual([])
    expect(rec.beats).toEqual([])
    expect(rec.done).toEqual([])
  })

  it('handles a run with no count-in', () => {
    const rec = recordRun({ countIn: 0, totalBeats: 2 })
    new Metronome().start(rec.run)
    vi.advanceTimersByTime(10_000)
    expect(rec.beats.map((b) => b.index)).toEqual([0, 1])
    expect(Object.is(rec.beats[0].index, 0)).toBe(true)
    expect(rec.done).toHaveLength(1)
  })

  it('delays each cue by the output latency so it lands with the audible click', () => {
    FakeAudioContext.latency = { outputLatency: 0.15, baseLatency: 0.05 }
    const rec = recordRun()
    new Metronome().start(rec.run)
    vi.advanceTimersByTime(10_000)
    const clicks = clickTimes()
    rec.beats.forEach((b, i) => expect(b.at).toBeCloseTo(clicks[i] + 0.2, 2))
    expect(rec.done[0]).toBeCloseTo(clicks[clicks.length - 1] + 0.5 + 0.2, 2)
  })

  it('skips beats that are already late after a stall instead of cueing them in a burst', () => {
    const rec = recordRun({ countIn: 4, totalBeats: 8 })
    new Metronome().start(rec.run)
    // Clicks at 0.1, 0.6, 1.1 have played; nothing is queued at 1.3.
    vi.advanceTimersByTime(1_300)
    expect(rec.beats.map((b) => b.index)).toEqual([-4, -3, -2])
    // The main thread stalls for 2 s: the clocks jump, no timer fires meanwhile.
    vi.setSystemTime(Date.now() + 2_000)
    vi.advanceTimersByTime(10_000)

    // Beats due at 1.6 .. 3.1 were missed; the run resumes on the 3.6 beat.
    expect(rec.beats.map((b) => b.index)).toEqual([-4, -3, -2, 3, 4, 5, 6, 7])
    for (let i = 1; i < rec.beats.length; i++) {
      expect(rec.beats[i].at - rec.beats[i - 1].at).toBeGreaterThan(0.45)
    }
    expect(ctx().oscillators).toHaveLength(8)
    expect(rec.done).toHaveLength(1)
  })
})
