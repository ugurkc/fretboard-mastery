/** Beat times in [nextTime, horizon), spaced by secondsPerBeat. */
export function beatsInWindow(nextTime: number, horizon: number, secondsPerBeat: number): number[] {
  if (!(Number.isFinite(secondsPerBeat) && secondsPerBeat > 0)) return []
  const times: number[] = []
  for (let t = nextTime; t < horizon; t += secondsPerBeat) times.push(t)
  return times
}

const LOOKAHEAD_SECONDS = 0.1
const TICK_MS = 25
const START_DELAY_SECONDS = 0.1
/** Beats due further in the past than this are skipped, not played late. */
const LATE_SECONDS = 0.05

export interface MetronomeRun {
  bpm: number
  /** Clicks before beat 0; their indices are negative (-countIn .. -1). */
  countIn: number
  totalBeats: number
  isAccent: (index: number) => boolean
  /** Called on time with each beat, including count-in beats. */
  onBeat: (index: number) => void
  /** Called one beat after the last beat. */
  onDone: () => void
}

type ClickKind = 'count' | 'beat' | 'accent'

export class Metronome {
  private ctx: AudioContext | null = null
  /** This run's output; disconnecting it silences clicks already scheduled. */
  private out: GainNode | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private uiTimers: ReturnType<typeof setTimeout>[] = []

  /** Must be called from a user gesture (click) so the browser allows audio. */
  start(run: MetronomeRun): void {
    this.stop()
    const valid =
      Number.isFinite(run.bpm) &&
      run.bpm > 0 &&
      Number.isInteger(run.countIn) &&
      run.countIn >= 0 &&
      Number.isInteger(run.totalBeats) &&
      run.totalBeats >= 0
    if (!valid) return
    this.ctx ??= new AudioContext()
    const ctx = this.ctx
    ctx.resume().catch(() => {})
    this.out = ctx.createGain()
    this.out.connect(ctx.destination)
    const secondsPerBeat = 60 / run.bpm
    let index = 0 - run.countIn
    let nextTime = ctx.currentTime + START_DELAY_SECONDS

    const tick = () => {
      for (const time of beatsInWindow(nextTime, ctx.currentTime + LOOKAHEAD_SECONDS, secondsPerBeat)) {
        if (index >= run.totalBeats) {
          this.clearScheduler()
          this.at(time, () => {
            this.stop()
            run.onDone()
          })
          return
        }
        const beat = index
        index += 1
        nextTime = time + secondsPerBeat
        if (time < ctx.currentTime - LATE_SECONDS) continue
        this.click(time, beat < 0 ? 'count' : run.isAccent(beat) ? 'accent' : 'beat')
        this.at(time, () => run.onBeat(beat))
      }
    }
    // Set the interval before the first tick so a run that ends in that tick clears it.
    this.timer = setInterval(tick, TICK_MS)
    tick()
  }

  stop(): void {
    this.clearScheduler()
    for (const t of this.uiTimers) clearTimeout(t)
    this.uiTimers = []
    this.out?.disconnect()
    this.out = null
  }

  private clearScheduler(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  /** Runs fn when a sound scheduled at `time` reaches the speakers. */
  private at(time: number, fn: () => void): void {
    const ctx = this.ctx
    if (!ctx) return
    // Safari has no outputLatency.
    const latency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
    const delayMs = Math.max(0, (time + latency - ctx.currentTime) * 1000)
    this.uiTimers.push(setTimeout(fn, delayMs))
  }

  private click(time: number, kind: ClickKind): void {
    const ctx = this.ctx
    const out = this.out
    if (!ctx || !out) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = kind === 'accent' ? 1500 : kind === 'count' ? 800 : 1000
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(0.5, time + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
    osc.connect(gain).connect(out)
    osc.start(time)
    osc.stop(time + 0.06)
  }
}
