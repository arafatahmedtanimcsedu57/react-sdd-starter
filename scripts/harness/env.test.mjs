// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkEnvironment, findInstallDrift, nvmrcMismatch, satisfies } from './env.mjs'

describe('satisfies', () => {
  const engines = '^22.22.2 || >=24.15.0'

  it.each([
    ['v22.22.2', true],
    ['v22.30.0', true],
    ['v24.15.0', true],
    ['v26.1.0', true],
    ['v20.19.5', false],
    ['v22.22.1', false],
    ['v23.0.0', false],
    ['v24.11.1', false],
  ])('%s against the project engines → %s', (version, expected) => {
    expect(satisfies(version, engines)).toBe(expected)
  })

  it('handles bare majors, tilde and AND-ed comparators', () => {
    expect(satisfies('v24.21.0', '24')).toBe(true)
    expect(satisfies('v22.1.0', '24')).toBe(false)
    expect(satisfies('v24.3.9', '~24.3')).toBe(true)
    expect(satisfies('v24.4.0', '~24.3')).toBe(false)
    expect(satisfies('v24.0.0', '>=22 <25')).toBe(true)
    expect(satisfies('v25.0.0', '>=22 <25')).toBe(false)
  })

  it('refuses ranges it does not understand instead of guessing', () => {
    expect(() => satisfies('v24.0.0', '24.x')).toThrow(/unsupported/)
  })
})

describe('findInstallDrift', () => {
  const lock = {
    '': { name: 'app' },
    'node_modules/zod': { version: '4.6.5' },
    'node_modules/msw': { version: '3.0.1' },
    'node_modules/@esbuild/darwin-arm64': { version: '0.25.0', optional: true },
  }

  it('is empty when every required package is installed at the locked version', () => {
    const installed = {
      'node_modules/zod': lock['node_modules/zod'],
      'node_modules/msw': lock['node_modules/msw'],
    }
    expect(findInstallDrift(lock, installed)).toEqual([])
  })

  it('names missing and outdated packages, skipping optional ones', () => {
    const installed = { 'node_modules/msw': { version: '2.15.0' } }
    expect(findInstallDrift(lock, installed)).toEqual([
      'zod@4.6.5 is not installed',
      'msw is 2.15.0, the lockfile wants 3.0.1',
    ])
  })
})

describe('checkEnvironment', () => {
  const base = { engines: '>=24', nvmrc: '24', lock: {}, installed: {} }

  it('passes a correct setup', () => {
    expect(checkEnvironment({ ...base, nodeVersion: 'v24.21.0' })).toEqual([])
  })

  it('reports the wrong Node with a fix a human can run', () => {
    const [problem] = checkEnvironment({ ...base, nodeVersion: 'v20.19.5' })
    expect(problem).toMatch(/Node v20\.19\.5 does not satisfy .*>=24.*\.nvmrc: 24/)
    expect(problem).toMatch(/FIX \(human\): `nvm use`/)
  })

  it('reports missing node_modules', () => {
    expect(checkEnvironment({ ...base, nodeVersion: 'v24.21.0', installed: null })).toEqual([
      'node_modules is missing.\n  FIX: npm ci',
    ])
  })

  it('caps a long drift list at five lines', () => {
    const lock = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [`node_modules/p${i}`, { version: '1.0.0' }]),
    )
    const [problem] = checkEnvironment({ ...base, nodeVersion: 'v24.21.0', lock })
    expect(problem).toMatch(/p4@1\.0\.0 is not installed\n {2}…and 2 more\n {2}FIX: npm ci$/)
  })
})

describe('nvmrcMismatch', () => {
  it('warns only when the running Node differs from the pinned one', () => {
    expect(nvmrcMismatch('v24.21.0', '24')).toBeNull()
    expect(nvmrcMismatch('v22.22.2', '24')).toMatch(/\.nvmrc pins 24/)
    expect(nvmrcMismatch('v22.22.2', 'lts/*')).toBeNull()
    expect(nvmrcMismatch('v22.22.2', null)).toBeNull()
  })
})
