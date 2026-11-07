// The orchestrator's board: one row per task (= one OpenSpec change, one worker, one PR).
// Local to this developer (.claude/orchestra/board.json, gitignored); the orchestrator is
// its only writer. Workers report through the STATUS line of each stop.
//
//   npm run board                                   print the board + "Needs you"
//   npm run board -- add <id> --title "…" --feature F03 --folders a,b [--depends x,y] [--contract] [--first]
//   npm run board -- set <id> --status coding [--need gate1] [--note "…"] [--worker …] [--worktree …] [--branch …] [--pr 12]
//   npm run board -- status <id> "<worker's last message>"   apply its STATUS line
//   npm run board -- next                           task ids that may start now
//   npm run board -- check <id>                     its branch changed only its own folders?
//   npm run board -- sync                           PRs merged / closed since (needs gh)
//   npm run board -- reset                          move a broken board aside, start empty
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'
import { parseArgs } from 'node:util'
import {
  parseBoard,
  parseOrchestraConfig,
  parseStatus,
  renderBoard,
  runnableTasks,
  TASK_STATUSES,
  taskOutOfScope,
} from './lib.mjs'
import { fail, path, readFeatures } from './io.mjs'

const BOARD = path('.claude/orchestra/board.json')
const CONFIG = path('.claude/orchestra.json')

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: 'string' },
    feature: { type: 'string' },
    folders: { type: 'string' },
    depends: { type: 'string' },
    contract: { type: 'boolean' },
    first: { type: 'boolean' },
    status: { type: 'string' },
    need: { type: 'string' },
    note: { type: 'string' },
    worker: { type: 'string' },
    worktree: { type: 'string' },
    branch: { type: 'string' },
    pr: { type: 'string' },
  },
})
const [command = 'show', id, message] = positionals
const list = (s) =>
  s
    ? s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : []

let maxWorkers
try {
  ;({ maxWorkers } = parseOrchestraConfig(
    existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, 'utf8')) : {},
  ))
} catch (error) {
  fail(error.message)
}

function read() {
  if (!existsSync(BOARD)) return { tasks: [] }
  try {
    return parseBoard(JSON.parse(readFileSync(BOARD, 'utf8')))
  } catch (error) {
    return fail(`${error.message}\n  FIX: npm run board -- reset, then add the tasks again`)
  }
}

function write(board) {
  let next
  try {
    next = parseBoard(board)
  } catch (error) {
    fail(error.message)
  }
  mkdirSync(dirname(BOARD), { recursive: true })
  writeFileSync(BOARD, `${JSON.stringify(next, null, 2)}\n`)
}

function update(board, taskId, change) {
  if (!board.tasks.some((t) => t.id === taskId)) fail(`${taskId} is not on the board.`)
  const tasks = board.tasks.map((t) => {
    if (t.id !== taskId) return t
    const next = { ...t, ...change, updatedAt: new Date().toISOString() }
    if (next.status !== 'needs-you' && next.status !== 'blocked') delete next.need
    return next
  })
  write({ tasks })
}

function featureTitles() {
  if (!existsSync(path('features.json'))) return {}
  return Object.fromEntries(readFeatures().features.map((f) => [f.id, f.title]))
}

function prState(pr) {
  const run = spawnSync('gh', ['pr', 'view', String(pr), '--json', 'state', '-q', '.state'], {
    encoding: 'utf8',
  })
  if (run.error) fail('sync needs the GitHub CLI (gh), signed in.')
  return run.status === 0 ? { state: run.stdout.trim() } : { error: run.stderr.trim() }
}

if (command === 'reset') {
  if (existsSync(BOARD)) {
    const aside = `${BOARD}.${Date.now()}.bak`
    renameSync(BOARD, aside)
    console.log(`✓ board moved to ${aside}; the board is empty now`)
  } else console.log('board is already empty')
  process.exit(0)
}

const board = read()
switch (command) {
  case 'show':
    console.log(renderBoard(board, { maxWorkers, featureTitles: featureTitles() }))
    break
  case 'add': {
    if (!id || !values.title || !values.feature || !values.folders) {
      fail('add needs <id>, --title, --feature and --folders.')
    }
    if (board.tasks.some((t) => t.id === id)) fail(`${id} is already on the board.`)
    write({
      tasks: [
        ...board.tasks,
        {
          id,
          title: values.title,
          feature: values.feature,
          folders: list(values.folders),
          dependsOn: list(values.depends),
          contract: Boolean(values.contract),
          first: Boolean(values.first),
          status: 'planned',
          updatedAt: new Date().toISOString(),
        },
      ],
    })
    console.log(`✓ ${id} planned`)
    break
  }
  case 'set': {
    if (values.status && !TASK_STATUSES.includes(values.status)) {
      fail(`Unknown status "${values.status}". One of: ${TASK_STATUSES.join(', ')}.`)
    }
    if (values.status === 'needs-you' && !values.need) {
      fail('--status needs-you needs --need (gate1 or question).')
    }
    const change = Object.fromEntries(
      ['status', 'need', 'note', 'worker', 'worktree', 'branch']
        .filter((k) => values[k] !== undefined)
        .map((k) => [k, values[k]]),
    )
    if (values.pr) change.pr = Number(values.pr)
    update(board, id, change)
    console.log(`✓ ${id} updated`)
    break
  }
  case 'status': {
    const parsed = parseStatus(message ?? '')
    const change = parsed ?? {
      status: 'blocked',
      need: 'question',
      note: 'no STATUS line — ask the worker',
    }
    update(board, id, change)
    console.log(
      `✓ ${id}: ${change.status}${change.need ? ` (${change.need})` : ''} — ${change.note}`,
    )
    break
  }
  case 'next':
    console.log(runnableTasks(board, { maxWorkers }).join('\n') || '(nothing can start now)')
    break
  case 'check': {
    const task = board.tasks.find((t) => t.id === id) ?? fail(`${id} is not on the board.`)
    if (!task.worktree) fail(`${id} has no worktree on the board.`)
    const wt = isAbsolute(task.worktree) ? task.worktree : path(task.worktree)
    const base = ['origin/HEAD', 'origin/main', 'origin/master'].find(
      (ref) => spawnSync('git', ['-C', wt, 'rev-parse', '--verify', '-q', ref]).status === 0,
    )
    if (!base) fail(`${id}: no origin default branch to compare against (git fetch first).`)
    const files = execFileSync('git', ['-C', wt, 'diff', '--name-only', `${base}...HEAD`], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
    const outside = taskOutOfScope(files, task)
    if (outside.length) {
      fail(
        `${id} changed files outside its folders (${task.folders.join(', ')}):\n` +
          outside.map((f) => `  ${f}`).join('\n') +
          '\nFIX: send them back to the worker to undo, or ask the owner to widen the task.',
      )
    }
    console.log(`✓ ${id}: ${files.length} changed files, all inside its folders`)
    break
  }
  case 'sync':
    for (const t of board.tasks.filter((x) => x.status === 'pr-open' && x.pr)) {
      const { state, error } = prState(t.pr)
      if (error) console.error(`✗ ${t.id}: PR #${t.pr}: ${error}`)
      else if (state === 'MERGED') {
        update(read(), t.id, { status: 'merged' })
        console.log(`✓ ${t.id}: PR #${t.pr} merged`)
      } else if (state === 'CLOSED') {
        update(read(), t.id, {
          status: 'blocked',
          need: 'question',
          note: `PR #${t.pr} closed unmerged`,
        })
        console.log(`✗ ${t.id}: PR #${t.pr} was closed without merging — ask the owner`)
      }
    }
    break
  default:
    fail(
      `Unknown command "${command}". Commands: show, add, set, status, next, check, sync, reset.`,
    )
}
