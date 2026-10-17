/** Beat times in [nextTime, horizon), spaced by secondsPerBeat. */
export function beatsInWindow(nextTime: number, horizon: number, secondsPerBeat: number): number[] {
  if (!(Number.isFinite(secondsPerBeat) && secondsPerBeat > 0)) return []
  const times: number[] = []
  for (let t = nextTime; t < horizon; t += secondsPerBeat) times.push(t)
  return times
}
