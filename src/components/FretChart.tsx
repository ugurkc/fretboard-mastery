import { OPEN_NAMES, STRINGS_DOWN, WINDOW_SIZE, chartLabel } from '../lib/notes'

export function FretChart({ windowStart }: { windowStart: number }) {
  const frets = Array.from({ length: WINDOW_SIZE }, (_, i) => windowStart + i)
  return (
    <div className="chart-scroll">
      <table className="chart">
        <caption>Notes in frets {windowStart}–{windowStart + WINDOW_SIZE - 1}, standard tuning</caption>
        <thead>
          <tr>
            <th scope="col">String</th>
            {frets.map((f) => (
              <th key={f} scope="col">
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STRINGS_DOWN.map((s) => (
            <tr key={s}>
              <th scope="row">
                {s} <span className="muted">{OPEN_NAMES[s]}</span>
              </th>
              {frets.map((f) => {
                const label = chartLabel(s, f)
                return (
                  <td key={f} className={label.length === 1 ? 'nat' : 'acc'}>
                    {label}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
