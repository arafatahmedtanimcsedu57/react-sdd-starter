// @vitest-environment node
// `npm run progress -- migrate` end to end in a throwaway repo: per-person sections of
// PROGRESS.md move into progress/<id>.md, once, without overwriting anything.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const CLI = fileURLToPath(new URL('./progress.mjs', import.meta.url))
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
let dir

const migrate = () => spawnSync('node', [CLI, 'migrate'], { cwd: dir, encoding: 'utf8', env: ENV })
const read = (rel) => readFileSync(join(dir, rel), 'utf8')
const progress = (text) => writeFileSync(join(dir, 'PROGRESS.md'), text)

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'harness-progress-'))
  execFileSync('git', ['init', '-q'], { cwd: dir, env: ENV })
  writeFileSync(
    join(dir, 'team.json'),
    JSON.stringify({
      version: 1,
      members: [{ github: 'bo', email: 'bo@x.io' }, { github: 'ana' }],
    }),
  )
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('npm run progress -- migrate', () => {
  it('moves each section to its file (email → login when joined) and keeps the shared part', () => {
    progress(
      '# Progress\n\n## Team-wide\n- t\n\n## @ana\n\n### Next step\n\n- a\n\n## bo@x.io\n- b\n',
    )
    const run = migrate()
    expect(run.status).toBe(0)
    expect(read('progress/ana.md')).toBe('# Progress — @ana\n\n## Next step\n\n- a\n')
    expect(read('progress/bo.md')).toBe('# Progress — @bo\n\n- b\n')
    expect(read('PROGRESS.md')).toBe('# Progress\n\n## Team-wide\n- t\n')
    expect(migrate().stdout).toMatch(/nothing to move/)
  })

  it('leaves a section whose file already exists, and says so', () => {
    writeFileSync(
      join(dir, 'team.json'),
      JSON.stringify({ version: 1, members: [{ github: 'ana' }] }),
    )
    execFileSync('mkdir', ['-p', join(dir, 'progress')])
    writeFileSync(join(dir, 'progress/ana.md'), 'mine')
    progress('# Progress\n\n## @ana\n- old\n\n## @cy\n- c\n')
    const run = migrate()
    expect(run.status).toBe(0)
    expect(run.stderr).toMatch(/@ana: progress\/ana.md already exists/)
    expect(read('progress/ana.md')).toBe('mine')
    expect(read('progress/cy.md')).toMatch(/- c/)
    expect(read('PROGRESS.md')).toBe('# Progress\n\n## @ana\n\n- old\n')
  })

  it('writes nothing when two sections map to one file', () => {
    progress('# Progress\n\n## @bo\n- 1\n\n## bo@x.io\n- 2\n')
    const run = migrate()
    expect(run.status).toBe(1)
    expect(run.stderr).toMatch(/Two sections map to progress\/bo.md/)
    expect(existsSync(join(dir, 'progress'))).toBe(false)
  })
})
