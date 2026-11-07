// @vitest-environment node
// `npm run team` end to end in a throwaway repo, with a fake `gh` that reports a login.
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI = fileURLToPath(new URL('./roster.mjs', import.meta.url))
let dir
let bin

const team = (args, login = 'Ana-Dev', email = 'ana@x.io') => {
  execFileSync('git', ['config', 'user.email', email], { cwd: dir })
  return spawnSync('node', [CLI, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_LOGIN: login },
  })
}
const roster = () => JSON.parse(readFileSync(join(dir, 'team.json'), 'utf8'))

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'harness-team-'))
  bin = join(dir, '.bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\necho "$FAKE_LOGIN"\n')
  chmodSync(join(bin, 'gh'), 0o755)
  execFileSync('git', ['init', '-q'], { cwd: dir })
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
    expect(team([]).stdout).toMatch(/@ana-dev {2}joined as ana@x.io[\s\S]*@bo {2}not joined yet/)
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
})
