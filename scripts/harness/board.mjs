// The orchestrator's board: one row per task (= one OpenSpec change, one worker, one PR).
// Local to this developer (.claude/orchestra/board.json, gitignored); the orchestrator is
// its only writer. Workers report through the STATUS line of each stop.
//
//   npm run board                                   print the board + "Needs you"
//   npm run board -- add <id> --title "…" --feature F03 --folders a,b [--depends x,y] [--contract] [--first]
//   npm run board -- set <id> --status coding [--need gate1] [--note "…"] [--worker …] [--worktree …] [--branch …] [--pr 12]
//   npm run board -- status <id> "<worker's last message>"   apply its STATUS line
//   npm run board -- next                           task ids that may start now
//   npm run board -- sync                           mark open PRs that were merged (needs gh)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { parseBoard, parseStatus, renderBoard, runnableTasks, TASK_STATUSES } from './lib.mjs'
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

const config = existsSync(CONFIG) ? JSON.parse(readFileSync(CONFIG, 'utf8')) : {}
const maxWorkers = config.maxWorkers ?? 4

function read() {
  if (!existsSync(BOARD)) return { tasks: [] }
  try {
    return parseBoard(JSON.parse(readFileSync(BOARD, 'utf8')))
  } catch (error) {
    return fail(`${error.message}\n  FIX: npm run board -- set … (never edit board.json by hand)`)
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
  const tasks = board.tasks.map((t) =>
    t.id === taskId ? { ...t, ...change, updatedAt: new Date().toISOString() } : t,
  )
  write({ tasks })
}

function featureTitles() {
  try {
    return Object.fromEntries(readFeatures().features.map((f) => [f.id, f.title]))
  } catch {
    return {}
  }
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
    const change = Object.fromEntries(
      ['status', 'need', 'note', 'worker', 'worktree', 'branch']
        .filter((k) => values[k] !== undefined)
        .map((k) => [k, values[k]]),
    )
    if (values.pr) change.pr = Number(values.pr)
    if (values.status && values.status !== 'needs-you' && values.need === undefined) {
      change.need = undefined
    }
    update(board, id, change)
    console.log(`✓ ${id} updated`)
    break
  }
  case 'status': {
    const parsed = parseStatus(message ?? '')
    const change = parsed
      ? { need: undefined, ...parsed }
      : { status: 'blocked', need: 'question', note: 'no STATUS line — ask the worker' }
    update(board, id, change)
    console.log(
      `✓ ${id}: ${change.status}${change.need ? ` (${change.need})` : ''} — ${change.note}`,
    )
    break
  }
  case 'next':
    console.log(runnableTasks(board, { maxWorkers }).join('\n') || '(nothing can start now)')
    break
  case 'sync':
    for (const t of board.tasks.filter((x) => x.status === 'pr-open' && x.pr)) {
      let state = ''
      try {
        state = execFileSync(
          'gh',
          ['pr', 'view', String(t.pr), '--json', 'state', '-q', '.state'],
          {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          },
        ).trim()
      } catch {
        fail('sync needs the GitHub CLI (gh), signed in.')
      }
      if (state === 'MERGED') {
        update(read(), t.id, { status: 'merged' })
        console.log(`✓ ${t.id}: PR #${t.pr} merged`)
      }
    }
    break
  default:
    fail(`Unknown command "${command}". Commands: show, add, set, status, next, sync.`)
}
