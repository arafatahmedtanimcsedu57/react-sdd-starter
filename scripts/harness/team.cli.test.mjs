// @vitest-environment node
// `npm run team` end to end in a throwaway repo, with a fake `gh` that reports a login.
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI = fileURLToPath(new URL('./roster.mjs', import.meta.url))
const MODULES = fileURLToPath(new URL('../../node_modules', import.meta.url))
// CI has no global git identity and no npx cache: the throwaway repo gets its own git config
// and this checkout's node_modules (the CLI formats team.json with the local prettier).
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
let dir
let bin

const team = (args, login = 'Ana-Dev', email = 'ana@x.io') => {
  execFileSync('git', ['config', 'user.email', email], { cwd: dir, env: ENV })
  return spawnSync('node', [CLI, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...ENV, PATH: `${bin}:${process.env.PATH}`, FAKE_LOGIN: login },
  })
}
const roster = () => JSON.parse(readFileSync(join(dir, 'team.json'), 'utf8'))

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'harness-team-'))
  bin = join(dir, '.bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\necho "$FAKE_LOGIN"\n')
  chmodSync(join(bin, 'gh'), 0o755)
  execFileSync('git', ['init', '-q'], { cwd: dir, env: ENV })
  symlinkSync(MODULES, join(dir, 'node_modules'))
  mkdirSync(join(dir, '.github'))
  writeFileSync(join(dir, '.github/CODEOWNERS'), '# owners\n*  @old\n/openspec/  @old\n')
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('npm run team', () => {
  it('says how to start when there is no team', () => {
    expect(team([]).stdout).toMatch(/npm run team -- add @login/)
  })

  it('adds members and refuses a duplicate', () => {
    expect(team(['add', '@Ana-Dev']).status).toBe(0)
    expect(team(['add', 'bo']).status).toBe(0)
    expect(team(['add', '@ana-dev']).stderr).toMatch(/already on the team/)
    expect(roster().members).toEqual([{ github: 'Ana-Dev' }, { github: 'bo' }])
  })

  it('lets a member join with their own login and email, and nobody else', () => {
    expect(team(['join'], 'eve', 'eve@x.io').stderr).toMatch(/@eve is not on the team/)
    const run = team(['join'], 'ana-dev', 'ana@x.io')
    expect(run.stdout).toMatch(/@ana-dev ↔ ana@x.io/)
    expect(roster().members[0]).toEqual({ github: 'ana-dev', email: 'ana@x.io' })
    expect(readFileSync(join(dir, 'progress/ana-dev.md'), 'utf8')).toMatch(/# Progress — @ana-dev/)
    expect(team([]).stdout).toMatch(
      /@ana-dev {2}lead, joined as ana@x.io[\s\S]*@bo {2}not joined yet/,
    )
    const ledger = readFileSync(join(dir, 'features.ledger.jsonl'), 'utf8').trim().split('\n')
    expect(ledger.map(JSON.parse)).toEqual([
      expect.objectContaining({ event: 'join', github: 'ana-dev', by: 'ana@x.io' }),
    ])
    team(['join'], 'ana-dev', 'ana@x.io') // again, same link: not recorded twice
    expect(
      readFileSync(join(dir, 'features.ledger.jsonl'), 'utf8').trim().split('\n'),
    ).toHaveLength(1)
  })

  it('writes CODEOWNERS with every member on every line', () => {
    expect(team(['codeowners']).status).toBe(0)
    expect(readFileSync(join(dir, '.github/CODEOWNERS'), 'utf8')).toBe(
      '# owners\n*  @ana-dev @bo\n/openspec/  @ana-dev @bo\n',
    )
  })

  it('renames a handoff file written under the email when that member joins', () => {
    mkdirSync(join(dir, 'progress'), { recursive: true })
    writeFileSync(join(dir, 'progress/bo@x.io.md'), '# Progress — bo@x.io\n\n- notes\n')
    const run = team(['join'], 'bo', 'bo@x.io')
    expect(run.stdout).toMatch(/progress\/bo.md \(renamed from progress\/bo@x.io.md/)
    expect(readFileSync(join(dir, 'progress/bo.md'), 'utf8')).toMatch(/- notes/)
    expect(existsSync(join(dir, 'progress/bo@x.io.md'))).toBe(false)
  })
})
