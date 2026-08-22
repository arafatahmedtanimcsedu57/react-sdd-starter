import { describe, it, expect } from 'vitest'
import { sum } from './math'

describe('sum', () => {
  it('is 0 for an empty list', () => expect(sum([])).toBe(0))
  it('adds the values', () => expect(sum([2, 3, 5])).toBe(10))
})
