/** Beat times in [nextTime, horizon), spaced by secondsPerBeat. */
export function beatsInWindow(nextTime: number, horizon: number, secondsPerBeat: number): number[] {
  const times: number[] = []
  for (let t = nextTime; t < horizon; t += secondsPerBeat) times.push(t)
  return times
}
