import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('shows seconds under a minute and m/ss above', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(45.6)).toBe('45s')
    expect(formatDuration(200)).toBe('3m 20s')
    expect(formatDuration(300)).toBe('5m 00s')
  })
})
