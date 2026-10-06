// @vitest-environment node
// .claude/hooks/trace.sh: `run` must behave exactly like the `out=$(cmd 2>&1)` it replaced
// (same $out, same exit code) and must never fail a hook, whatever bash it runs on.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const TRACE_SH = join(dirname(fileURLToPath(import.meta.url)), '../../.claude/hooks/trace.sh')
let dir

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'trace-sh-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const bash = (script) =>
  spawnSync('bash', ['-c', `set -u; . "${TRACE_SH}"; ${script}`], { cwd: dir, encoding: 'utf8' })

const traced = () => {
  const [file] = readdirSync(join(dir, '.claude/traces'))
  return readFileSync(join(dir, '.claude/traces', file), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse)
}

describe('trace.sh run', () => {
  it('keeps the output and exit code, and appends one JSON line', () => {
    const r = bash(
      `TRACE_DETAIL=src/a.ts run hook step sh -c 'echo out; echo err >&2; exit 3'; c=$?; printf '%s|%s' "$c" "$out"`,
    )
    expect(r.stdout).toBe('3|out\nerr')
    expect(traced()).toEqual([
      expect.objectContaining({ source: 'hook', step: 'step', exit: 3, detail: 'src/a.ts' }),
    ])
    expect(typeof traced()[0].ms).toBe('number')
  })

  it('works without EPOCHREALTIME (bash < 5) and records ms as null', () => {
    const r = bash(`unset EPOCHREALTIME; run hook step true; echo "exit=$?"`)
    expect(r.stdout).toBe('exit=0\n')
    expect(traced()[0]).toMatchObject({ exit: 0, ms: null })
  })

  it('still returns the command result when the trace cannot be written', () => {
    const r = bash(
      `mkdir -p .claude && touch .claude/traces; run hook step sh -c 'exit 4'; echo "exit=$?"`,
    )
    expect(r.stdout).toBe('exit=4\n')
    expect(r.stderr).toBe('')
  })
})
