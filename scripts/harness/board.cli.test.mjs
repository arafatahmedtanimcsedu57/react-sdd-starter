// @vitest-environment node
// `npm run board` end to end, in a throwaway repo with an origin remote and a fake `gh`.
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI = fileURLToPath(new URL('./board.mjs', import.meta.url))
let dir
let bin

const git = (...args) =>
  execFileSync('git', ['-c', 'user.email=t@t.t', '-c', 'user.name=t', ...args], {
    cwd: dir,
    stdio: 'pipe',
  })
const board = (args, env = {}) =>
  spawnSync('node', [CLI, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ...env },
  })
const saved = () => JSON.parse(readFileSync(join(dir, '.claude/orchestra/board.json'), 'utf8'))
const row = (id) => saved().tasks.find((t) => t.id === id)

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'harness-board-'))
  bin = join(dir, '.bin')
  mkdirSync(bin)
  // Fake gh: PR 1 merged, PR 2 closed, anything else not found.
  writeFileSync(
    join(bin, 'gh'),
    '#!/bin/sh\ncase "$3" in 1) echo MERGED;; 2) echo CLOSED;; *) echo "no pull request $3" >&2; exit 1;; esac\n',
  )
  chmodSync(join(bin, 'gh'), 0o755)
  const remote = `${dir}-remote.git`
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote])
  git('init', '-q', '-b', 'main')
  writeFileSync(join(dir, '.gitignore'), '.bin/\n.claude/orchestra/\n')
  git('add', '.')
  git('commit', '-qm', 'base')
  git('remote', 'add', 'origin', remote)
  git('push', '-q', 'origin', 'main')
  git('remote', 'set-head', 'origin', 'main')
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
  rmSync(`${dir}-remote.git`, { recursive: true, force: true })
})

describe('npm run board', () => {
  it('shows an empty board without features.json', () => {
    const run = board([])
    expect(run.status).toBe(0)
    expect(run.stdout).toContain('Needs you — nothing')
  })

  it('adds tasks and sets status, clearing a stale need', () => {
    board([
      'add',
      'contract',
      '--title',
      'Contract',
      '--feature',
      'F03',
      '--folders',
      'src/a',
      '--first',
    ])
    board([
      'add',
      'form',
      '--title',
      'Form',
      '--feature',
      'F03',
      '--folders',
      'src/b',
      '--depends',
      'contract',
    ])
    expect(board(['set', 'contract', '--status', 'needs-you', '--need', 'gate1']).status).toBe(0)
    expect(row('contract').need).toBe('gate1')
    board(['set', 'contract', '--status', 'coding'])
    expect(row('contract')).toMatchObject({ status: 'coding' })
    expect(row('contract').need).toBeUndefined()
  })

  it('refuses needs-you without a need, an unknown status and a non-numeric PR', () => {
    expect(board(['set', 'form', '--status', 'needs-you']).stderr).toMatch(/needs --need/)
    expect(board(['set', 'form', '--status', 'done']).stderr).toMatch(/Unknown status "done"/)
    expect(board(['set', 'form', '--pr', 'abc']).status).toBe(1)
    expect(row('form').pr).toBeUndefined()
  })

  it('turns a stop without a STATUS line into blocked', () => {
    board(['status', 'contract', 'I am done, I think'])
    expect(row('contract')).toMatchObject({ status: 'blocked', need: 'question' })
    board(['status', 'contract', 'notes\nSTATUS: ready | - | check green'])
    expect(row('contract')).toMatchObject({ status: 'ready', note: 'check green' })
  })

  it('checks a branch changed only its task folders', () => {
    git('switch', '-q', '-c', 'feat/f03/contract')
    mkdirSync(join(dir, 'src/a'), { recursive: true })
    mkdirSync(join(dir, 'src/b'), { recursive: true })
    writeFileSync(join(dir, 'src/a/schema.ts'), 'export {}\n')
    git('add', '.')
    git('commit', '-qm', 'in scope')
    board(['set', 'contract', '--worktree', '.'])
    expect(board(['check', 'contract']).stdout).toMatch(/1 changed files, all inside/)
    writeFileSync(join(dir, 'src/b/Form.tsx'), 'export {}\n')
    git('add', '.')
    git('commit', '-qm', 'out of scope')
    const run = board(['check', 'contract'])
    expect(run.status).toBe(1)
    expect(run.stderr).toContain('src/b/Form.tsx')
  })

  it('syncs merged and closed PRs, reporting a missing one without stopping', () => {
    board(['set', 'contract', '--status', 'pr-open', '--pr', '1'])
    board(['set', 'form', '--status', 'pr-open', '--pr', '2'])
    board(['add', 'other', '--title', 'Other', '--feature', 'F04', '--folders', 'src/c'])
    board(['set', 'other', '--status', 'pr-open', '--pr', '9'])
    const run = board(['sync'])
    expect(run.stderr).toContain('PR #9: no pull request 9')
    expect(row('contract').status).toBe('merged')
    expect(row('form')).toMatchObject({ status: 'blocked', note: 'PR #2 closed unmerged' })
    expect(row('other').status).toBe('pr-open')
  })

  it('points a broken board at reset, and reset recovers', () => {
    writeFileSync(join(dir, '.claude/orchestra/board.json'), '{"tasks":[{"id":"Bad"}]}')
    expect(board([]).stderr).toMatch(/npm run board -- reset/)
    expect(board(['reset']).status).toBe(0)
    expect(board([]).stdout).toContain('Needs you — nothing')
  })
})
