import { describe, it, expect } from 'vitest'
import { apiBaseUrl, env } from './env'

describe('env', () => {
  it('defaults the API to same-origin /api', () => {
    expect(env.VITE_API_URL).toBe('/api')
    expect(apiBaseUrl).toBe('http://localhost:5173/api')
  })
})
