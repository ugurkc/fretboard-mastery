# fretboard-mastery

A practice app for learning every note on the guitar fretboard, deployed to
`https://ugurkc.github.io/fretboard-mastery/` on every push to `main`. Part of
[ugurkc.github.io](https://github.com/ugurkc/ugurkc.github.io); the design spec is
`docs/plans/2026-10-17-fretboard-design.md` in that repo.

## Shape

- `src/lib/` — all method logic, framework-free; every logic module has a Vitest suite (`steps.ts` is copy only):
  `notes.ts` (note names, fret maths for standard tuning and a 12-fret window),
  `sequence.ts` (the beat sequence of every exercise), `progress.ts` (progress state,
  reducer, unlock rules, localStorage load/save), `metronome.ts` (Web Audio lookahead
  scheduler), `format.ts`, `steps.ts` (step copy).
- `src/components/` — React views only; they render state and dispatch `ProgressEvent`s.
  `PositionsScreen` is step 0 (a study page: every position of a note on one chart, no
  metronome); `PracticeScreen` runs practice steps 1–5.
- No CMS: there is no editable prose.

## Rules the app must keep (from the method)

- Strings in order, never skipped: up = 6→1, down = 1→6.
- During practice (steps 1–5) the app never shows which fret to play; step 0 is the one place
  positions are shown. The practice chart is a reference with no highlight.
- Steps 0–5: step 0 never gates and is never ticked; practice steps unlock in order, and a
  locked step can still be opened after a warning.
- The app does not listen to the guitar. The player reports "clean" after each set.

## Testing conventions

- `npm run test` runs the full suite; CI runs it before every deploy. Never add
  `--passWithNoTests`.
- Logic changes go in `src/lib/` with a test first. UI is checked by hand in the browser
  (`npm run dev`), including phone width.

## Commit convention

No `Co-Authored-By` or "Generated with Claude Code" trailers on commits.
