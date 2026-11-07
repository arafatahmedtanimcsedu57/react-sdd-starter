// File, git and process helpers shared by the harness CLIs. Logic lives in lib.mjs.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseFeatureList, parseTraceLines, replayFeatures } from './lib.mjs'

export const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()
export const path = (rel) => join(ROOT, rel)

export const PROGRESS = 'PROGRESS.md'

// One JSON line per hook / verify / clock-out step, per UTC day, in the MAIN checkout (the
// parent of the .git all worktrees share), so a worker worktree's steps outlive it.
// Gitignored: local evidence, not history. .claude/hooks/trace.sh writes the same shape.
// Resolved when used (inside the callers' error handling), not at import: every harness CLI
// imports this file, and `--path-format` needs git ≥ 2.31.
export function tracesDir() {
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir')
  return common.startsWith('/') ? join(dirname(common), '.claude/traces') : path('.claude/traces')
}

export const FEATURES = 'features.json'
export const LEDGER = 'features.ledger.jsonl'

// Bookkeeping any feature may touch, on top of its own scope.
export const ALWAYS_IN_SCOPE = [
  'openspec/',
  'design/',
  'e2e/',
  'features.md',
  FEATURES,
  LEDGER,
  'PROGRESS.md',
  'DECISIONS.md',
]

export function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return ''
  }
}

export function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

export function readList() {
  if (!existsSync(path(FEATURES))) fail(`${FEATURES} is missing.`)
  try {
    const raw = JSON.parse(readFileSync(path(FEATURES), 'utf8'))
    if (raw.version === 1) {
      return fail(
        `${FEATURES} is version 1 (state stored inside). The harness now keeps state only in ` +
          `the ledger.\n  FIX (human): npm run features -- migrate`,
      )
    }
    return parseFeatureList(raw)
  } catch (error) {
    return fail(error.message)
  }
}

// Prettier owns the layout of everything it formats, so a script write never fails
// `npm run format:check`.
export function format(rel) {
  execFileSync('npx', ['--no-install', 'prettier', '--write', '--log-level', 'warn', path(rel)], {
    cwd: ROOT,
  })
}

export function writeList(list) {
  writeFileSync(path(FEATURES), `${JSON.stringify(list, null, 2)}\n`)
  format(FEATURES)
}

export function readLedger() {
  if (!existsSync(path(LEDGER))) return []
  return readFileSync(path(LEDGER), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

/** The developer running the command: `git config user.email`, or '' when unset. */
export function me() {
  return git('config', 'user.email')
}

/** Definitions, ledger and the replayed features (definition + state) in one read. */
export function readFeatures() {
  const list = readList()
  const ledger = readLedger()
  return { list, ledger, features: replayFeatures(list, ledger) }
}

export function appendLedger(entry) {
  const line = {
    at: new Date().toISOString(),
    commit: git('rev-parse', '--short', 'HEAD'),
    by: me() || 'unknown',
    ...entry,
  }
  appendFileSync(path(LEDGER), `${JSON.stringify(line)}\n`)
}

/** Where this branch forked from the default branch (falls back to HEAD on a fresh repo). */
export function forkPoint() {
  const candidates = [
    git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD'),
    'origin/main',
    'origin/master',
    'main',
    'master',
  ].filter(Boolean)
  for (const ref of candidates) {
    const base = git('merge-base', 'HEAD', ref)
    if (base) return base
  }
  return 'HEAD'
}

export const DEFAULT_BRANCH = /^(main|master)$/

/**
 * Files changed on this branch: committed since the fork point, staged, unstaged, untracked,
 * and deleted (deleting a file is a change too). On the default branch itself only
 * uncommitted work counts, so unpushed history isn't blamed on the active feature.
 */
export function changedFiles() {
  const onDefault = DEFAULT_BRANCH.test(git('rev-parse', '--abbrev-ref', 'HEAD'))
  const lists = [
    git('diff', '--name-only', onDefault ? 'HEAD' : forkPoint()),
    git('ls-files', '--others', '--exclude-standard'),
  ]
  return [...new Set(lists.join('\n').split('\n').filter(Boolean))].sort()
}

/** Records one step. Tracing must never break the thing it traces, so errors are dropped. */
export function appendTrace(entry) {
  const at = new Date().toISOString()
  try {
    const dir = tracesDir()
    mkdirSync(dir, { recursive: true })
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
    appendFileSync(
      join(dir, `${at.slice(0, 10)}.jsonl`),
      `${JSON.stringify({ at, ...(branch ? { branch } : {}), ...entry })}\n`,
    )
  } catch {
    // no trace is better than a failed verify
  }
}

export function readTraces(day) {
  const file = join(tracesDir(), `${day}.jsonl`)
  return existsSync(file) ? parseTraceLines(readFileSync(file, 'utf8')) : []
}
