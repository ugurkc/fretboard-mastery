import type { StepId } from './progress'

export interface StepInfo {
  label: string
  instructions: string
  goal: string
}

export const STEP_INFO: Record<StepId, StepInfo> = {
  1: {
    label: 'One note',
    instructions:
      "Pick a natural note and play it on every string, 6 to 1 and back to 6, at your own pace. Press Space or tap Next for each string. Use the chart if you need it. Don't try to memorise shapes; just play.",
    goal: 'Three clean rounds per note. All seven notes, twice through.',
  },
  2: {
    label: '40 BPM',
    instructions:
      'The same exercise with the metronome at 40 BPM: one note per click. Stay at 40 even if it feels slow. The small time pressure is what makes it stick.',
    goal: 'Three clean rounds at 40 BPM for each natural note.',
  },
  3: {
    label: 'Sharps & flats',
    instructions:
      'Add the sharps and flats at 40 BPM. For a sharp, find the natural note and go up one fret; for a flat, find it and go down one. A♯ and B♭ are separate exercises because you think of them differently.',
    goal: 'Three clean rounds at 40 BPM for each of the ten sharps and flats.',
  },
  4: {
    label: 'Two notes',
    instructions:
      "Two notes at a time: the first going up the strings, the second coming back down. Don't stop when the note changes.",
    goal: 'Practise until it feels easy, then mark the step done.',
  },
  5: {
    label: 'All seven',
    instructions:
      'All seven natural notes in a random order, alternating up and down, without stopping between notes.',
    goal: 'One clean pass at 40 BPM.',
  },
  6: {
    label: 'Speed up',
    instructions:
      'Go back through steps 2 to 5 and raise the tempo a little after each clean set. The app suggests 4 BPM more each time.',
    goal: 'Step 5 clean at 80 BPM. Then you know your fretboard.',
  },
}
