// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  parseBoard,
  parseOrchestraConfig,
  parseStatus,
  renderBoard,
  runnableTasks,
  taskOutOfScope,
  whyWaiting,
} from './lib.mjs'

const task = (id, over = {}) => ({
  id,
  title: id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
  feature: 'F03',
  folders: [`src/features/auth/${id}`],
  dependsOn: [],
  contract: false,
  first: false,
  status: 'planned',
  ...over,
})
const board = (...tasks) => parseBoard({ tasks })
const config = { maxWorkers: 2 }

describe('parseBoard', () => {
  it('fills defaults for a minimal task', () => {
    const b = parseBoard({
      tasks: [{ id: 'login-form', title: 'Login form', feature: 'F03', folders: ['src/a'] }],
    })
    expect(b.tasks[0]).toMatchObject({ status: 'planned', dependsOn: [], first: false })
  })

  it('refuses a non-kebab id, an unknown dependency and a duplicate', () => {
    expect(() => board(task('Login Form'))).toThrow(/kebab-case/)
    expect(() => board(task('a', { dependsOn: ['ghost'] }))).toThrow(/unknown task\(s\): ghost/)
    expect(() => board(task('a'), task('a'))).toThrow(/duplicate task: a/)
  })

  it('requires every other task of a feature to depend on its first task', () => {
    expect(() => board(task('kickoff', { first: true }), task('form'))).toThrow(
      /form must depend on kickoff, the first task of F03/,
    )
    expect(
      board(task('kickoff', { first: true }), task('form', { dependsOn: ['kickoff'] })).tasks,
    ).toHaveLength(2)
  })

  it('allows only one first task per feature', () => {
    expect(() => board(task('a', { first: true }), task('b', { first: true }))).toThrow(
      /F03 has more than one first task/,
    )
  })
})

describe('parseStatus', () => {
  it('reads the last STATUS line of a stop', () => {
    const stop =
      'did things\nSTATUS: drafting | - | early\n…\nSTATUS: needs-you | gate1 | tasks.md ready'
    expect(parseStatus(stop)).toEqual({
      status: 'needs-you',
      need: 'gate1',
      note: 'tasks.md ready',
    })
  })

  it('tolerates the line wrapped in backticks or bold', () => {
    expect(parseStatus('`STATUS: ready | - | check green`')).toEqual({
      status: 'ready',
      note: 'check green',
    })
    expect(parseStatus('**STATUS:** coding | - | 2/5')).toEqual({ status: 'coding', note: '2/5' })
  })

  it('treats "-" as no need', () => {
    expect(parseStatus('STATUS: coding | - | 3/7 tasks')).toEqual({
      status: 'coding',
      note: '3/7 tasks',
    })
  })

  it('is null without a STATUS line or with a status a worker may not report', () => {
    expect(parseStatus('all done!')).toBeNull()
    expect(parseStatus('STATUS: merged | - | x')).toBeNull()
    expect(parseStatus('STATUS: pr-open | - | x')).toBeNull() // the orchestrator opens PRs
  })
})

describe('runnableTasks / whyWaiting', () => {
  it('starts independent tasks up to the worker cap', () => {
    const b = board(task('a'), task('b'), task('c'))
    expect(runnableTasks(b, config)).toEqual(['a', 'b'])
  })

  it('counts running workers against the cap', () => {
    const b = board(task('a', { status: 'coding' }), task('b', { status: 'needs-you' }), task('c'))
    expect(runnableTasks(b, config)).toEqual([])
    expect(whyWaiting(b.tasks[2], b.tasks, config)).toBe('worker cap (2) reached')
  })

  it('waits for dependencies until they are merged', () => {
    const b = board(
      task('contract', { status: 'pr-open' }),
      task('form', { dependsOn: ['contract'] }),
    )
    expect(runnableTasks(b, config)).toEqual([])
    expect(whyWaiting(b.tasks[1], b.tasks, config)).toBe('waits for: Contract')
    const merged = board(
      task('contract', { status: 'merged' }),
      task('form', { dependsOn: ['contract'] }),
    )
    expect(runnableTasks(merged, config)).toEqual(['form'])
  })

  it('lets dependants of a contract-only task start once its PR is open', () => {
    const b = board(
      task('contract', { status: 'pr-open', contract: true }),
      task('form', { dependsOn: ['contract'] }),
    )
    expect(runnableTasks(b, config)).toEqual(['form'])
  })

  it('never runs two tasks that share a folder, including ones picked in the same round', () => {
    const shared = { folders: ['src/routes'] }
    const b = board(task('a', shared), task('b', { folders: ['src/routes/Login.tsx'] }))
    expect(runnableTasks(b, { maxWorkers: 4 })).toEqual(['a'])
    const running = board(task('a', { ...shared, status: 'coding' }), task('b', shared))
    expect(whyWaiting(running.tasks[1], running.tasks, config)).toBe('shares src/routes with A')
  })
})

describe('folders held until merge', () => {
  it('keeps a ready or pr-open task holding its folders, without using a worker slot', () => {
    const shared = { folders: ['src/routes'] }
    const b = board(task('a', { ...shared, status: 'pr-open' }), task('b', shared), task('c'))
    expect(runnableTasks(b, { maxWorkers: 1 })).toEqual(['c'])
    expect(whyWaiting(b.tasks[1], b.tasks, config)).toBe('shares src/routes with A')
  })
})

describe('blocked tasks', () => {
  it('keep holding their folders — the worker may have stopped mid-edit', () => {
    const shared = { folders: ['src/routes'] }
    const b = board(task('a', { ...shared, status: 'blocked' }), task('b', shared))
    expect(runnableTasks(b, config)).toEqual([])
  })
})

describe('taskOutOfScope', () => {
  const t = task('login-form', { folders: ['src/features/auth/LoginForm'] })

  it('allows the task folders and its own change only', () => {
    const files = [
      'src/features/auth/LoginForm/LoginForm.tsx',
      'openspec/changes/login-form/tasks.md',
      'src/features/auth/Register/Register.tsx',
      'openspec/changes/other/tasks.md',
      'features.json',
    ]
    expect(taskOutOfScope(files, t)).toEqual([
      'src/features/auth/Register/Register.tsx',
      'openspec/changes/other/tasks.md',
      'features.json',
    ])
  })

  it('lets only the first task touch the feature list', () => {
    expect(taskOutOfScope(['features.json'], { ...t, first: true })).toEqual([])
  })
})

describe('parseOrchestraConfig', () => {
  it('defaults and validates the worker cap', () => {
    expect(parseOrchestraConfig(undefined)).toEqual({ maxWorkers: 4 })
    expect(() => parseOrchestraConfig({ maxWorkers: 0 })).toThrow(/maxWorkers/)
  })
})

describe('renderBoard', () => {
  const b = board(
    task('auth-contract', { title: 'Auth contract', status: 'pr-open', pr: 34, contract: true }),
    task('login-form', {
      title: 'Login form',
      status: 'needs-you',
      need: 'gate1',
      note: '(6 tasks, ≈180 lines)',
      dependsOn: ['auth-contract'],
    }),
    task('password-reset', { title: 'Password reset', dependsOn: ['login-form'] }),
    task('dashboard-layout', {
      title: 'Dashboard layout',
      feature: 'F04',
      status: 'coding',
      note: '3/7',
    }),
  )
  const out = renderBoard(b, { maxWorkers: 4, featureTitles: { F03: 'Login/Registration' } })

  it('groups by feature with readable names and worker count', () => {
    expect(out).toContain('Board — workers 2/4')
    expect(out).toContain('Login/Registration (F03)')
    expect(out).toContain('F04 (F04)')
    expect(out).toMatch(/↑ Auth contract \.+ pr-open\s+PR #34/)
    expect(out).toMatch(/◷ Password reset \.+ planned\s+waits for: Login form/)
  })

  it('lists what needs the owner', () => {
    expect(out).toContain('1. Login form — approve tasks.md? (6 tasks, ≈180 lines)')
    expect(renderBoard(board(task('a')), { maxWorkers: 4 })).toContain('Needs you — nothing')
  })
})
