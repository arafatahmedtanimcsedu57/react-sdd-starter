// @vitest-environment node
// Two developers' branches both append ledger lines and both add a DECISIONS.md entry in the
// same place. With the repo's .gitattributes (merge=union) a real `git merge` must finish
// without a conflict and keep every line. Without it, this is the conflict every PR hit.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const ATTRIBUTES = readFileSync(new URL('../../.gitattributes', import.meta.url), 'utf8')
const DECISIONS = '# Decisions\n\n---\n\n## 2026-01-01: base\n\n- Why: base\n'

let dir
const git = (...args) =>
  execFileSync('git', ['-c', 'user.email=t@t.t', '-c', 'user.name=t', ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: 'pipe',
  })
const write = (file, text) => writeFileSync(join(dir, file), text)
const read = (file) => readFileSync(join(dir, file), 'utf8')
const addDecision = (title) => read('DECISIONS.md').replace('---\n\n', `---\n\n## ${title}\n\n`)

function branchWith(name, ledgerLine, decision) {
  git('switch', '-q', '-c', name, 'base')
  write('features.ledger.jsonl', `${read('features.ledger.jsonl')}${ledgerLine}\n`)
  write('DECISIONS.md', addDecision(decision))
  git('commit', '-qam', name)
}

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('.gitattributes union merge', () => {
  it('merges two branches that append ledger lines and add decisions, without conflicts', () => {
    dir = mkdtempSync(join(tmpdir(), 'harness-merge-'))
    git('init', '-q', '-b', 'base')
    write('.gitattributes', ATTRIBUTES)
    write('features.ledger.jsonl', '{"id":"F01","to":"not_started"}\n')
    write('DECISIONS.md', DECISIONS)
    git('add', '.')
    git('commit', '-qm', 'base')

    branchWith('me', '{"id":"F03","to":"active"}', '2026-02-01: mine')
    branchWith('x', '{"id":"F04","to":"active"}', '2026-02-02: theirs')

    git('switch', '-q', 'me')
    expect(() => git('merge', '-q', '--no-edit', 'x')).not.toThrow()

    const ledger = read('features.ledger.jsonl')
    expect(ledger).toContain('"F03"')
    expect(ledger).toContain('"F04"')
    expect(ledger.split('\n').filter(Boolean)).toHaveLength(3)
    const decisions = read('DECISIONS.md')
    expect(decisions).toContain('## 2026-02-01: mine')
    expect(decisions).toContain('## 2026-02-02: theirs')
    expect(decisions).toContain('## 2026-01-01: base')
    expect(decisions).not.toMatch(/^(<<<<<<<|=======|>>>>>>>)/m)
  })
})
