export function formatDuration(seconds: number): string {
  const total = Math.floor(seconds)
  if (total < 60) return `${total}s`
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`
}
