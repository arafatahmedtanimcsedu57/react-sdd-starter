// File, git and process helpers shared by the harness CLIs. Logic lives in lib.mjs.
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { parseFeatureList, renderProgressBlock, summariseTasks } from './lib.mjs'

export const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()
export const path = (rel) => join(ROOT, rel)

export const FEATURES = 'features.json'
export const LEDGER = 'features.ledger.jsonl'
export const PROGRESS = 'PROGRESS.md'
// One JSON line per hook step / verify command, per UTC day. Gitignored: local evidence,
// not history. The hooks write the same shape from .claude/hooks/trace.sh.
export const TRACES = '.claude/traces'

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
    return parseFeatureList(JSON.parse(readFileSync(path(FEATURES), 'utf8')))
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

export function appendLedger(entry) {
  const line = {
    at: new Date().toISOString(),
    commit: git('rev-parse', '--short', 'HEAD'),
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

const DEFAULT_BRANCH = /^(main|master)$/

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

const CHANGES = 'openspec/changes'

function openChanges() {
  if (!existsSync(path(CHANGES))) return []
  return readdirSync(path(CHANGES), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'archive')
    .filter((d) => existsSync(path(`${CHANGES}/${d.name}/tasks.md`)))
    .map((d) => ({
      name: d.name,
      ...summariseTasks(readFileSync(path(`${CHANGES}/${d.name}/tasks.md`), 'utf8')),
    }))
}

/** PROGRESS.md's generated block, from the repo's real state right now. */
export function buildProgressBlock() {
  return renderProgressBlock({
    date: new Date().toISOString().slice(0, 10),
    branch: git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
    features: readList(),
    changes: openChanges(),
  })
}

/** Records one step. Tracing must never break the thing it traces, so errors are dropped. */
export function appendTrace(entry) {
  const at = new Date().toISOString()
  try {
    mkdirSync(path(TRACES), { recursive: true })
    appendFileSync(
      path(`${TRACES}/${at.slice(0, 10)}.jsonl`),
      `${JSON.stringify({ at, ...entry })}\n`,
    )
  } catch {
    // no trace is better than a failed verify
  }
}

export function readTraces(day) {
  const file = path(`${TRACES}/${day}.jsonl`)
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return [] // a half-written line from a killed hook
      }
    })
}
