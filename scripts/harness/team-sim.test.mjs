// @vitest-environment node
// A team on the harness, end to end: a bare repo plays GitHub, one clone per developer,
// a fake `gh`, and "merge a PR" = merge into master + `features check` (CI). Replays the
// scenarios that broke in the 2026-11-08 simulation (openspec team-scale) so a harness
// change that breaks team work fails here.
import { execFileSync, spawnSync } from 'node:child_process'
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const HARNESS = fileURLToPath(new URL('.', import.meta.url))
const MODULES = fileURLToPath(new URL('../../node_modules', import.meta.url))
let world
let bin

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
const clone = (who) => join(world, who)

/** `who` runs `node scripts/harness/<script> …args` in their own clone. */
function as(who, script, ...args) {
  const r = spawnSync('node', [join(HARNESS, script), ...args], {
    cwd: clone(who),
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_LOGIN: who },
  })
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}` }
}

function dev(who) {
  const dir = clone(who)
  git(world, 'clone', '-q', 'origin.git', who)
  git(dir, 'config', 'user.email', `${who}@team.io`)
  git(dir, 'config', 'user.name', who)
  symlinkSync(MODULES, join(dir, 'node_modules'))
}

/** A fresh branch from master in `who`'s clone. */
function branch(who, name) {
  const dir = clone(who)
  git(dir, 'fetch', '-q')
  git(dir, 'switch', '-q', '-c', name, 'origin/master')
}

function push(who, message) {
  const dir = clone(who)
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
  git(dir, 'push', '-q', '-u', 'origin', 'HEAD')
}

/** GitHub's merge + CI. Returns 'merged', 'conflict' or the CI failure. */
function mergePr(name) {
  const gh = clone('github')
  git(gh, 'fetch', '-q', 'origin')
  git(gh, 'checkout', '-q', '-B', 'master', 'origin/master')
  try {
    git(gh, 'merge', '-q', '--no-ff', '--no-edit', `origin/${name}`)
  } catch (error) {
    if (!git(gh, 'diff', '--name-only', '--diff-filter=U')) throw error
    git(gh, 'merge', '--abort')
    return 'conflict'
  }
  const ci = as('github', 'features.mjs', 'check')
  if (!ci.ok) return ci.out
  git(gh, 'push', '-q', 'origin', 'master')
  return 'merged'
}

/** A feature as /kickoff writes it: features.md entry + `features add`. */
function addFeature(who, title, owner, id) {
  const r = as(
    who,
    'features.mjs',
    'add',
    '--title',
    title,
    '--owner',
    owner,
    '--verify',
    'npx vitest run src/x',
    '--scope',
    `src/features/${title.toLowerCase()}`,
    ...(id ? ['--id', id] : []),
  )
  const newId = /added (F\d+)/.exec(r.out)?.[1]
  if (newId) appendFileSync(join(clone(who), 'features.md'), `\n## ${title}\n\n**ID:** ${newId}\n`)
  return { ...r, id: newId }
}

beforeAll(() => {
  world = mkdtempSync(join(tmpdir(), 'harness-team-sim-'))
  bin = join(world, '.bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\necho "$FAKE_LOGIN"\n')
  chmodSync(join(bin, 'gh'), 0o755)

  const seed = join(world, 'seed')
  mkdirSync(join(seed, '.github'), { recursive: true })
  git(seed, 'init', '-q', '-b', 'master')
  writeFileSync(join(seed, '.gitattributes'), 'features.ledger.jsonl merge=union\n')
  writeFileSync(join(seed, 'features.json'), '{ "version": 2, "features": [] }\n')
  writeFileSync(join(seed, 'features.ledger.jsonl'), '')
  writeFileSync(join(seed, 'features.md'), '# Features\n')
  writeFileSync(
    join(seed, 'team.json'),
    JSON.stringify({ version: 1, members: ['ana', 'bo', 'cy'].map((github) => ({ github })) }),
  )
  writeFileSync(join(seed, '.github/CODEOWNERS'), '*  @ana @bo @cy\n')
  writeFileSync(join(seed, 'CLAUDE.md'), '# Project\n')
  writeFileSync(join(seed, '.gitignore'), 'node_modules\n')
  writeFileSync(join(seed, 'PROGRESS.md'), '# Progress\n')
  git(seed, 'add', '-A')
  git(seed, 'commit', '-q', '-m', 'seed')
  git(world, 'clone', '-q', '--bare', 'seed', 'origin.git')
  for (const who of ['github', 'ana', 'bo', 'cy']) dev(who)

  // Everyone joins (one PR each), then the lead adds three features.
  for (const who of ['ana', 'bo', 'cy']) {
    branch(who, `join-${who}`)
    as(who, 'roster.mjs', 'join')
    push(who, `join ${who}`)
    expect(mergePr(`join-${who}`)).toBe('merged')
  }
  branch('ana', 'kickoff')
  for (const [title, owner] of [
    ['Auth', '@ana'],
    ['Dashboard', '@bo'],
    ['Reports', '@bo'],
  ]) {
    expect(addFeature('ana', title, owner).ok).toBe(true)
  }
  addFeature('ana', 'Profile', '@bo')
  push('ana', 'kickoff')
  expect(mergePr('kickoff')).toBe('merged')
}, 60_000)
afterAll(() => rmSync(world, { recursive: true, force: true }))

describe('a team on the harness', () => {
  it('S7: the same feature started on two branches keeps master green', () => {
    for (const b of ['f01-a', 'f01-b']) {
      branch('ana', b)
      expect(as('ana', 'features.mjs', 'start', 'F01').ok).toBe(true)
      push('ana', b)
    }
    expect(mergePr('f01-a')).toBe('merged')
    expect(mergePr('f01-b')).toBe('merged')
  })

  it('S6: three branches over the limit merge, and check warns', () => {
    for (const id of ['F02', 'F03', 'F04']) {
      branch('bo', `start-${id}`)
      expect(as('bo', 'features.mjs', 'start', id).ok).toBe(true)
      push('bo', id)
    }
    for (const id of ['F02', 'F03', 'F04']) expect(mergePr(`start-${id}`)).toBe('merged')
    expect(as('github', 'features.mjs', 'check').out).toMatch(
      /⚠ @bo has 3 active \(F02, F03, F04\); the limit is 2/,
    )
  })

  it('S4: two people adding a feature the same day get different ids', () => {
    branch('ana', 'add-chat')
    const chat = addFeature('ana', 'Chat', '@ana')
    push('ana', 'chat')
    branch('cy', 'add-export')
    const exp = addFeature('cy', 'Export', '@cy')
    expect([chat.id, exp.id]).toEqual(['F05', 'F06'])
    expect(addFeature('cy', 'Again', '@cy', 'F05').out).toMatch(
      /F05 is already taken on origin\/add-chat/,
    )
    push('cy', 'export')
    expect(mergePr('add-chat')).toBe('merged')
    // Both append to the end of features.json / features.md: a plain git conflict remains,
    // but resolving it with "keep both" no longer creates a duplicate id.
    expect(['merged', 'conflict']).toContain(mergePr('add-export'))
  })

  it("S5: a lead hands over a departed member's feature, with a reason; others cannot", () => {
    branch('cy', 'grab')
    expect(as('cy', 'features.mjs', 'owner', 'F02', '--set', '@cy').out).toMatch(
      /belongs to @bo; you are @cy/,
    )
    branch('ana', 'bo-left')
    expect(as('ana', 'features.mjs', 'owner', 'F04', '--set', '@cy').out).toMatch(/--reason/)
    expect(
      as('ana', 'features.mjs', 'owner', 'F04', '--set', '@cy', '--reason', 'bo left').ok,
    ).toBe(true)
    expect(as('ana', 'roster.mjs', 'remove', '@bo').out).toMatch(/still owns F02, F03/)
    push('ana', 'bo left')
    expect(mergePr('bo-left')).toBe('merged')
  })

  it('S3b: a late joiner is told to join on this branch', () => {
    branch('ana', 'add-dee')
    as('ana', 'roster.mjs', 'add', '@dee')
    const dee = addFeature('ana', 'Audit', '@dee')
    push('ana', 'dee')
    expect(mergePr('add-dee')).toBe('merged')
    dev('dee')
    branch('dee', 'early')
    expect(as('dee', 'features.mjs', 'start', dee.id).out).toMatch(
      /isn't linked to a GitHub login on this branch.*npm run team -- join/s,
    )
  })

  it('S9: a CODEOWNERS that misses a member fails harness:check', () => {
    branch('ana', 'drop-reviewer')
    writeFileSync(join(clone('ana'), '.github/CODEOWNERS'), '*  @ana @bo\n')
    const r = as('ana', 'instructions.mjs')
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/\.github\/CODEOWNERS \* misses @cy @dee/)
  })
})
