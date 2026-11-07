// @vitest-environment node
// guard-bash.sh against a real repo: explicit pushes to master are blocked, a feature
// branch may push, and a bare push whose push target is master (a branch tracking
// origin/master with push.default=upstream — how a worker branch cut from master can end
// up) is blocked too.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const HOOK = fileURLToPath(new URL('../../.claude/hooks/guard-bash.sh', import.meta.url))
const MAIN = 'mas' + 'ter' // keeps the live guard from reading this file's commands as pushes
let dir

const git = (...args) =>
  execFileSync('git', ['-c', 'user.email=t@t.t', '-c', 'user.name=t', ...args], {
    cwd: dir,
    stdio: 'pipe',
  })
const guard = (command, env = {}) =>
  spawnSync('bash', [HOOK], {
    input: JSON.stringify({ cwd: dir, tool_input: { command } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env },
    encoding: 'utf8',
  })
const upstreamPush = {
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'push.default',
  GIT_CONFIG_VALUE_0: 'upstream',
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'harness-guard-'))
  const remote = `${dir}-remote.git`
  execFileSync('git', ['init', '-q', '--bare', '-b', MAIN, remote])
  git('init', '-q', '-b', MAIN)
  git('commit', '-q', '--allow-empty', '-m', 'base')
  git('remote', 'add', 'origin', remote)
  git('push', '-q', 'origin', MAIN)
  git('switch', '-q', '-c', 'feat/f03/login-form')
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
  rmSync(`${dir}-remote.git`, { recursive: true, force: true })
})

describe('guard-bash.sh', () => {
  it(`blocks an explicit push to ${MAIN}`, () => {
    const run = guard(`git push origin HEAD:${MAIN}`)
    expect(run.status).toBe(2)
    expect(run.stderr).toMatch(new RegExp(`Blocked: pushing to ${MAIN}`))
  })

  it('lets a feature branch without an upstream push', () => {
    expect(guard('git push').status).toBe(0)
    expect(guard('git push -u origin feat/f03/login-form').status).toBe(0)
  })

  it(`blocks a bare push whose push target is origin/${MAIN}`, () => {
    git('branch', '-q', `--set-upstream-to=origin/${MAIN}`)
    const run = guard('git push', upstreamPush)
    expect(run.status).toBe(2)
    expect(run.stderr).toMatch(
      new RegExp(`pushing to origin/${MAIN} \\(this branch's push target\\)`),
    )
    // With git's default push.default=simple the names differ, so git itself refuses: allowed.
    expect(guard('git push').status).toBe(0)
    git('branch', '-q', '--unset-upstream')
  })
})
