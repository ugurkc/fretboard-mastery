import type { StepId } from './progress'

export interface StepInfo {
  label: string
  instructions: string
  goal: string
}

export const STEP_INFO: Record<StepId, StepInfo> = {
  0: {
    label: 'Positions',
    instructions:
      "Study where each note lives before you practise. Pick a note and look at every place it sits, one per string, inside the 12 frets you're using. Come back here whenever you need to.",
    goal: 'No goal: this page is for reference.',
  },
  1: {
    label: 'One note',
    instructions:
      "Pick a natural note and play it on every string, 6 to 1 and back to 6, one note per click at 40 BPM. Stay at 40 even if it feels slow; the small time pressure is what makes it stick. Use the chart if you need it; don't try to memorise shapes.",
    goal: 'Three clean rounds at 40 BPM for each natural note.',
  },
  2: {
    label: 'Sharps & flats',
    instructions:
      'Add the sharps and flats at 40 BPM. For a sharp, find the natural note and go up one fret; for a flat, find it and go down one. A♯ and B♭ are separate exercises because you think of them differently.',
    goal: 'Three clean rounds at 40 BPM for each of the ten sharps and flats.',
  },
  3: {
    label: 'Two notes',
    instructions:
      "Two notes at a time: the first going up the strings, the second coming back down. Don't stop when the note changes.",
    goal: 'Practise until it feels easy, then mark the step done.',
  },
  4: {
    label: 'All seven',
    instructions:
      'All seven natural notes in a random order, alternating up and down, without stopping between notes.',
    goal: 'One clean pass at 40 BPM.',
  },
  5: {
    label: 'Speed up',
    instructions:
      'Go back through steps 1 to 4 and raise the tempo a little after each clean set. The app suggests 4 BPM more each time.',
    goal: 'Step 4 clean at 80 BPM. Then you know your fretboard.',
  },
}
