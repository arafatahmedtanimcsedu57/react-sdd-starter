// Pure logic behind the harness scripts (features, progress, scope, instructions).
// No file or process access here, so every rule is unit-tested in lib.test.mjs.
import { z } from 'zod'

export const STATES = ['not_started', 'active', 'blocked', 'passing']

// A proof command must be something a shell can run, not a description of one. Steps may
// be chained with `&&`; other shell syntax (; | $ ` < > newlines) is refused, because the
// command runs in a shell, including in the autopilot job.
const RUNNERS = /^(npx|npm|node|bash|sh|\.\/)\s*/
const SHELL_TRICKS = /[;|$`<>&\n]/ // tested after removing every `&&`
const proofCommand = z
  .string()
  .regex(RUNNERS, 'verify must be a runnable command (npx/npm/node/bash …)')
  .refine((cmd) => !SHELL_TRICKS.test(cmd.replaceAll('&&', '')), {
    message: 'verify may chain steps with && but no other shell syntax (; | $ ` < >)',
  })

const EMAIL = /^[^@\s]+@[^@\s]+$/
const LOGIN = /^[A-Za-z\d](?:[A-Za-z\d-]{0,38})$/ // a GitHub username
const owner = z
  .string()
  .refine((v) => EMAIL.test(v) || (v.startsWith('@') && LOGIN.test(v.slice(1))), {
    message: 'owner must be a git email (user@host) or a GitHub @login',
  })

// The roster (team.json): GitHub logins, and each member's git email once THEY run
// `npm run team -- join`. Owners may be either; the roster links them.
const teamSchema = z.object({
  version: z.literal(1),
  members: z.array(
    z.object({
      github: z.string().regex(LOGIN, 'github must be a GitHub username (no @)'),
      email: z.string().regex(EMAIL, 'email must look like user@host').optional(),
      name: z.string().optional(),
    }),
  ),
})

export function parseTeam(data) {
  const result = teamSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`team.json is invalid:\n  ${issues.join('\n  ')}`)
  }
  for (const key of ['github', 'email']) {
    const seen = new Set()
    for (const m of result.data.members) {
      const v = m[key]?.toLowerCase()
      if (!v) continue
      if (seen.has(v)) throw new Error(`team.json lists ${key} twice: ${m[key]}`)
      seen.add(v)
    }
  }
  return result.data
}

/** The GitHub login of the member who joined with `email`, if any. */
export function loginFor(team, email) {
  const e = email?.toLowerCase()
  return e ? team.members.find((m) => m.email?.toLowerCase() === e)?.github : undefined
}

/** `me` = `{ email, github? }`; a feature's owner is either form. */
export const asMe = (me) => (typeof me === 'string' ? { email: me } : (me ?? {}))
export function isOwner(featureOwner, me) {
  const { email, github } = asMe(me)
  if (email && featureOwner === email) return true
  return Boolean(github) && featureOwner.toLowerCase() === `@${github}`.toLowerCase()
}
const label = (me) => {
  const { email, github } = asMe(me)
  return github ? `@${github}` : email || 'unknown'
}

// Definitions only. State, attempts and evidence live in features.ledger.jsonl, which merges
// by union — so two developers' branches never conflict over a feature's state.
const featureSchema = z.object({
  id: z.string().regex(/^F\d{2,}$/, 'id must look like F01'),
  title: z.string().min(1),
  owner,
  verify: proofCommand,
  scope: z.array(z.string().min(1)).min(1, 'scope needs at least one folder or file'),
  change: z.string().optional(),
})

const listSchema = z.object({
  version: z.literal(2),
  limits: z.object({ activePerOwner: z.number().int().min(1) }).default({ activePerOwner: 2 }),
  features: z.array(featureSchema),
})

export function parseFeatureList(data) {
  const result = listSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`features.json is invalid:\n  ${issues.join('\n  ')}`)
  }
  const seen = new Set()
  for (const { id } of result.data.features) {
    if (seen.has(id)) throw new Error(`features.json has a duplicate id: ${id}`)
    seen.add(id)
  }
  return result.data
}

export function addFeature(list, input) {
  if (list.features.some((f) => f.id === input.id)) {
    throw new Error(`${input.id} already exists. Pick the next free id.`)
  }
  return parseFeatureList({ ...list, features: [...list.features, input] })
}

/**
 * Each feature's definition plus its state replayed from the ledger: state, attempts
 * (failed verifies since it last became active), evidence and blockedReason. Replay is per
 * feature, so union-merged lines from two owners give the same result in any order.
 */
export function replayFeatures(list, ledger) {
  return list.features.map((def) => {
    const feature = { ...def, state: undefined, attempts: 0 }
    for (const e of ledger) {
      if (e.id !== def.id) continue
      if (e.event === 'verify_failed') feature.attempts += 1
      if (!e.to) continue
      feature.state = e.to
      delete feature.blockedReason
      if (e.to === 'active') feature.attempts = 0
      if (e.to === 'blocked') feature.blockedReason = e.reason
      if (e.to === 'passing') feature.evidence = e.evidence ?? { commit: e.commit, at: e.at }
    }
    return feature
  })
}

const ALLOWED = {
  not_started: ['active'],
  active: ['blocked', 'passing'],
  blocked: ['active'],
  passing: [],
}

/**
 * The ledger line for moving `id` to `to`, or an error explaining why not. Only the owner
 * moves a feature, and an owner has at most `limits.activePerOwner` features active.
 */
export function transition(features, id, to, { me, limits, reason, evidence } = {}) {
  const current = features.find((f) => f.id === id)
  if (!current) throw new Error(`${id} is not in features.json.`)
  if (!isOwner(current.owner, me)) {
    throw new Error(
      `${id} belongs to ${current.owner}; you are ${label(me)}. Only its owner moves it — ` +
        `hand it over first (npm run features -- owner ${id} --set <@login|email>, ask a human).`,
    )
  }
  if (!ALLOWED[current.state]?.includes(to)) {
    throw new Error(`${id}: ${current.state} → ${to} is not allowed.`)
  }
  if (to === 'active') {
    const mine = features.filter((f) => isOwner(f.owner, me) && f.state === 'active' && f.id !== id)
    if (mine.length >= limits.activePerOwner) {
      throw new Error(
        `You already have ${mine.length} active (${mine.map((f) => f.id).join(', ')}); the limit ` +
          `is ${limits.activePerOwner} per owner. Finish one (npm run features -- verify <id>) ` +
          'or block it (npm run features -- block <id> --reason "…").',
      )
    }
  }
  if (to === 'blocked' && !reason) throw new Error(`Blocking ${id} needs a --reason.`)
  if (to === 'passing' && !evidence) {
    throw new Error(`${id} can only become passing with evidence from a verify run.`)
  }
  return {
    id,
    from: current.state,
    to,
    ...(to === 'blocked' ? { reason } : {}),
    ...(to === 'passing' ? { evidence } : {}),
  }
}

/** The last scope and owner the ledger recorded per feature. */
export function replayDefinitions(ledger) {
  const defs = {}
  for (const e of ledger) {
    const d = (defs[e.id] ??= {})
    if (Array.isArray(e.scope)) d.scope = e.scope
    if (e.owner) d.owner = e.owner
  }
  return defs
}

const sameScope = (a, b) => [...a].sort().join('\n') === [...b].sort().join('\n')

/**
 * Lines the CLI would never have written: a move that doesn't start from the feature's
 * replayed state (a hand-written line, or a history that forked on two branches and was
 * union-merged), a move that isn't allowed, `passing` without evidence, or a move, scope
 * change or hand-over by someone other than the owner. Lines from before owners existed
 * carry no `by`; once one line has it, every later line must.
 */
export function findLedgerAnomalies(ledger, team = { members: [] }) {
  const problems = []
  const state = {}
  const owner = {}
  let sawBy = false
  ledger.forEach((e, i) => {
    const where = `ledger line ${i + 1} (${e.id})`
    if (e.by) sawBy = true
    else if (sawBy) problems.push(`${where} has no "by" — written by hand?`)
    const checked = Boolean(e.by)
    const byOwner = () => isOwner(owner[e.id], { email: e.by, github: loginFor(team, e.by) })
    const notOwner = (what) =>
      checked && owner[e.id] && !byOwner()
        ? [`${where}: ${what} by ${e.by}, not the owner ${owner[e.id]}`]
        : []

    if (e.event === 'owner') {
      problems.push(...notOwner('owner changed'))
      owner[e.id] = e.owner
      return
    }
    if (!e.to) {
      if (Array.isArray(e.scope)) problems.push(...notOwner('scope changed'))
      return
    }
    const from = state[e.id] ?? null
    if ((e.from ?? null) !== from) {
      problems.push(
        `${where}: moves from "${e.from}" but the feature was "${from}" (forked or hand-written history)`,
      )
    }
    const allowed = from === null ? e.to === 'not_started' : ALLOWED[from]?.includes(e.to)
    if (!allowed) problems.push(`${where}: ${from} → ${e.to} is not allowed`)
    if (e.to === 'not_started') {
      if (e.owner) owner[e.id] = e.owner
    } else {
      if (checked && e.to === 'passing' && !e.evidence) {
        problems.push(`${where}: passing without evidence from a verify run`)
      }
      problems.push(...notOwner('moved'))
    }
    state[e.id] = e.to
  })
  return problems
}

/** Definitions in features.json that the ledger doesn't back up (edited by hand). */
export function findLedgerDrift(list, ledger, team) {
  const defs = replayDefinitions(ledger)
  const known = new Set(ledger.filter((e) => e.to === 'not_started').map((e) => e.id))
  return list.features
    .flatMap((f) => {
      if (!known.has(f.id)) return [`${f.id} is not in the ledger (added by hand?)`]
      const problems = []
      const recorded = defs[f.id] ?? {}
      if (!recorded.scope) problems.push(`${f.id} has no scope in the ledger`)
      else if (!sameScope(recorded.scope, f.scope)) {
        problems.push(
          `${f.id} scope is [${f.scope.join(', ')}] but the ledger says [${recorded.scope.join(', ')}]`,
        )
      }
      if (recorded.owner && recorded.owner !== f.owner) {
        problems.push(`${f.id} owner is ${f.owner} but the ledger says ${recorded.owner}`)
      }
      if (!recorded.owner) problems.push(`${f.id} has no owner in the ledger`)
      return problems
    })
    .concat(findLedgerAnomalies(ledger, team))
}

const covers = (entry, file) => {
  const base = entry.replace(/\/+$/, '')
  return file === base || file.startsWith(`${base}/`)
}

export function findOutOfScope(files, scope, alwaysAllowed) {
  const allowed = [...scope, ...alwaysAllowed]
  return files.filter((file) => !allowed.some((entry) => covers(entry, file)))
}

export function summariseTasks(markdown) {
  const boxes = [...markdown.matchAll(/^\s*- \[( |x|X)\]/gm)]
  const approval = markdown.match(/^approved:\s*(.+?)\s*$/m)?.[1]
  return {
    done: boxes.filter((m) => m[1] !== ' ').length,
    total: boxes.length,
    approved: approval && approval !== '<pending>' ? approval : null,
  }
}

/** Open OpenSpec changes this branch touched, from its changed files. */
export function changesTouched(files) {
  const names = files
    .map((f) => /^openspec\/changes\/([^/]+)\//.exec(f)?.[1])
    .filter((name) => name && name !== 'archive')
  return [...new Set(names)]
}

/** The feature id a proposal names ("Feature: F03"), or null for "Feature: none". */
export function proposalFeature(markdown) {
  return /^Feature:\s*(F\d{2,})\b/m.exec(markdown)?.[1] ?? null
}

/**
 * The feature ids the touched changes' proposals name. A proposal that names an id not in
 * features.json is a problem (the scope check must not silently fall back); a change
 * without a proposal or a usable "Feature:" line is only noted ("Feature: none" is fine).
 */
export function resolveChangeFeatures(proposals, features) {
  const ids = new Set(features.map((f) => f.id))
  const named = []
  const problems = []
  const notes = []
  for (const { name, text } of proposals) {
    if (text == null) {
      notes.push(`${name} has no proposal.md`)
      continue
    }
    const id = proposalFeature(text)
    if (id && ids.has(id)) named.push(id)
    else if (id) problems.push(`${name} names ${id}, which is not in features.json`)
    else if (!/^Feature:/m.test(text)) notes.push(`${name} has no "Feature:" line`)
    else if (!/^Feature:\s*none\b/m.test(text)) {
      notes.push(`${name} has a "Feature:" line that names no feature id (use F01 … or none)`)
    }
  }
  return { named: [...new Set(named)], problems, notes }
}

/**
 * Which features this branch works on: those named by the changes it touched, else the
 * caller's own active features. Two developers can each have features active; the scope
 * check must use the one this branch builds, not whichever comes first.
 */
export function scopeForBranch({ changeFeatures, features, me }) {
  const named = features.filter((f) => changeFeatures.includes(f.id))
  const picked = named.length
    ? named
    : features.filter((f) => f.state === 'active' && isOwner(f.owner, me))
  if (!picked.length) return null
  return { ids: picked.map((f) => f.id), scope: [...new Set(picked.flatMap((f) => f.scope))] }
}

/** The team summary `npm run progress` prints: counts, each owner's features, open changes. */
export function renderProgress({ features, changes }) {
  const count = (s) => features.filter((f) => f.state === s).length
  const owners = [...new Set(features.map((f) => f.owner))].sort()
  const label = (f) =>
    `${f.id} ${f.title} (${f.state.replace('_', ' ')}${f.blockedReason ? `: ${f.blockedReason}` : ''})`
  const openChanges = changes.map(
    (c) => `${c.name} ${c.done}/${c.total} ${c.approved ? 'approved' : 'approval pending'}`,
  )
  return [
    `Features — ${count('passing')} passing · ${count('active')} active · ${count('blocked')} blocked · ${count('not_started')} not started`,
    ...owners.map(
      (o) =>
        `  ${o}: ${features
          .filter((f) => f.owner === o)
          .map(label)
          .join(', ')}`,
    ),
    `Open OpenSpec changes — ${openChanges.join('; ') || 'none'}`,
  ].join('\n')
}

// PROGRESS.md used to hold a generated block; every clock-out rewrote it, so two developers
// always conflicted there. It is printed now, and must not come back into the file.
const OLD_MARKERS = /<!-- harness:auto:(start|end) -->/

export function checkProgressDoc(text) {
  return OLD_MARKERS.test(text)
    ? [
        'has the old generated block (harness:auto markers). Remove it; `npm run progress` prints it.',
      ]
    : []
}

/**
 * One developer's hand-written part of PROGRESS.md: the `## <email>` or `## @login` section up to the next
 * `## ` heading, whitespace-normalised — or null when they have no section yet.
 */
export function ownSection(doc, names) {
  const lines = String(doc).split('\n')
  const headings = [names]
    .flat()
    .filter(Boolean)
    .map((n) => `## ${n}`.toLowerCase())
  const start = lines.findIndex((l) => headings.includes(l.trim().toLowerCase()))
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^## /.test(l))
  return (end === -1 ? rest : rest.slice(0, end)).join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Clock-out's PROGRESS.md rule, or null when it holds. `now` / `before` are the caller's
 * section today and at the fork point (null = no section). Nothing changed → nothing to
 * hand off; on the default branch only the commit check applies.
 */
export function progressProblem({ changed, now, before, onDefault, email }) {
  if (!email) return 'git has no user.email.\nFIX: git config user.email you@example.com'
  if (!changed.length) return null
  if (now === null) {
    return `PROGRESS.md has no section for you.\nFIX: add "## ${email}" with Current work, Known issues, Next step.`
  }
  if (!onDefault && before !== null && before === now) {
    return `This branch changes files but not your PROGRESS.md section.\nFIX: update Current work, Known issues and Next step under "## ${email}".`
  }
  return null
}

// Untracked files a session typically leaves behind. `clock-out --fix` deletes these, and git
// never saw them, so a false positive is unrecoverable: `debug-*` only at the repo root, and
// nothing that looks like source or docs is ever junk.
const JUNK = [/\.log$/, /^debug-[^/]*$/, /\.(orig|rej|tmp|bak)$/, /(^|\/)\.DS_Store$/, /~$/]
const NEVER_JUNK = /\.([cm]?[jt]sx?|css|json|md|html)$/
export const findJunk = (untracked) =>
  untracked.filter((f) => !NEVER_JUNK.test(f) && JUNK.some((re) => re.test(f)))

/** Trace lines → entries, dropping half-written lines (a killed hook) and non-entries. */
export function parseTraceLines(text) {
  return text.split('\n').flatMap((line) => {
    try {
      const entry = JSON.parse(line)
      return typeof entry?.at === 'string' ? [entry] : []
    } catch {
      return []
    }
  })
}

/**
 * One aligned line per trace entry: time, branch (when entries come from several — worker
 * worktrees all trace into the main checkout), source/step, ok or ✗<exit>, duration, detail.
 */
export function formatTrace(entries) {
  const branches = new Set(entries.map((e) => e.branch ?? ''))
  const showBranch = branches.size > 1
  const bw = Math.max(0, ...entries.map((e) => (e.branch ?? '').length))
  const width = Math.max(0, ...entries.map((e) => `${e.source}/${e.step}`.length))
  return entries.map((e) => {
    const branch = showBranch ? `${(e.branch ?? '').padEnd(bw)}  ` : ''
    const name = `${e.source}/${e.step}`.padEnd(width)
    const status = (e.exit === 0 ? 'ok' : `✗${e.exit}`).padEnd(4)
    const ms = e.ms == null ? '' : `${e.ms}ms`.padStart(8)
    return `${e.at.slice(11, 19)}  ${branch}${name}  ${status}${ms}${e.detail ? `  ${e.detail}` : ''}`
  })
}

// Backticked repo paths to markdown files, without placeholders like <name> or globs.
const LINKED_DOC = /`([\w.\-/]+\.md)`/g

export function checkInstructions(text, { maxLines, exists }) {
  const problems = []
  const lines = text.replace(/\n$/, '').split('\n').length
  if (lines > maxLines) {
    problems.push(
      `is ${lines} lines (max ${maxLines}). Move a topic section into .claude/rules/*.md and link it.`,
    )
  }
  const linked = new Set([...text.matchAll(LINKED_DOC)].map((m) => m[1]))
  for (const path of linked) {
    if (path.includes('/') && !exists(path)) {
      problems.push(`links to \`${path}\`, which does not exist`)
    }
  }
  return problems
}

// ── Orchestrator board ──────────────────────────────────────────────────────────────────
// One row per task (= one OpenSpec change = one worker = one PR). The orchestrator is the
// only writer (`npm run board`); workers report through the STATUS line of each stop.

export const TASK_STATUSES = [
  'planned',
  'queued',
  'drafting',
  'needs-you',
  'coding',
  'checking',
  'ready',
  'pr-open',
  'merged',
  'finished',
  'blocked',
]
// A worker is alive while RUNNING (counts toward maxWorkers). A task keeps its folders until
// merged — `ready` (built, waiting for the orchestrator's review + PR) and `pr-open` too —
// so a new task never edits the same files and conflicts at merge.
const RUNNING = ['drafting', 'needs-you', 'coding', 'checking']
// `blocked` too: a worker may have stopped half-way through editing them.
const HOLDS_FOLDERS = [...RUNNING, 'ready', 'pr-open', 'blocked']
const DONE = ['merged', 'finished']
const WORKER_STATUSES = ['drafting', 'needs-you', 'coding', 'checking', 'ready', 'blocked']

const taskSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'task id must be kebab-case (it is the change name)'),
  title: z.string().min(1),
  feature: z.string().regex(/^F\d{2,}$/, 'feature must look like F03'),
  folders: z.array(z.string().min(1)).min(1, 'a task needs at least one folder'),
  dependsOn: z.array(z.string()).default([]),
  // Provides only a contract (Zod schema + MSW mock): dependants may start once its PR is open.
  contract: z.boolean().default(false),
  // The feature's first task is the only one that writes `features add/start` to the ledger.
  first: z.boolean().default(false),
  status: z.enum(TASK_STATUSES).default('planned'),
  need: z.string().optional(),
  note: z.string().optional(),
  worker: z.string().optional(),
  worktree: z.string().optional(),
  branch: z.string().optional(),
  pr: z.number().int().positive().optional(),
  updatedAt: z.string().optional(),
})

export function parseBoard(data) {
  const result = z.object({ tasks: z.array(taskSchema) }).safeParse(data)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`board is invalid:\n  ${issues.join('\n  ')}`)
  }
  const { tasks } = result.data
  const ids = new Set()
  for (const t of tasks) {
    if (ids.has(t.id)) throw new Error(`board has a duplicate task: ${t.id}`)
    ids.add(t.id)
  }
  for (const t of tasks) {
    const unknown = t.dependsOn.filter((d) => !ids.has(d))
    if (unknown.length) throw new Error(`${t.id} depends on unknown task(s): ${unknown.join(', ')}`)
  }
  const firsts = tasks.filter((t) => t.first)
  const twice = firsts.find((f, i) => firsts.findIndex((x) => x.feature === f.feature) !== i)
  if (twice) throw new Error(`${twice.feature} has more than one first task; only one may start it`)
  // The first task adds/starts the feature; until it exists on the branch a worker starts
  // from, that worker's scope check fails. So every other task builds on it.
  for (const first of firsts) {
    const loose = tasks.filter(
      (t) => t.feature === first.feature && t.id !== first.id && !t.dependsOn.includes(first.id),
    )
    if (loose.length) {
      throw new Error(
        `${loose.map((t) => t.id).join(', ')} must depend on ${first.id}, the first task of ${first.feature}`,
      )
    }
  }
  return result.data
}

const configSchema = z.object({ maxWorkers: z.number().int().min(1).max(8).default(4) })

/** `.claude/orchestra.json`, validated. */
export function parseOrchestraConfig(data) {
  const result = configSchema.safeParse(data ?? {})
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`.claude/orchestra.json is invalid:\n  ${issues.join('\n  ')}`)
  }
  return result.data
}

/**
 * Files a worker's branch changed outside its task: its folders, its own OpenSpec change
 * and — for the feature's first task only — the feature list. The hooks check the wider
 * feature scope; this is checked by the orchestrator before it reviews and pushes.
 */
export function taskOutOfScope(files, task) {
  const own = [`openspec/changes/${task.id}/`]
  if (task.first) own.push('features.md', 'features.json', 'features.ledger.jsonl')
  return findOutOfScope(files, task.folders, own)
}

/** `STATUS: <status> | <need or -> | <note>` — the last such line in a worker's stop. */
export function parseStatus(text) {
  // Tolerates the line wrapped in backticks or bold, as a model may echo the template.
  const lines = [
    ...String(text).matchAll(
      /^[\s`*]*STATUS:[*`]*\s*([\w-]+)\s*\|\s*([^|\n]*?)\s*\|\s*(.*?)[\s`*]*$/gm,
    ),
  ]
  const last = lines.at(-1)
  if (!last || !WORKER_STATUSES.includes(last[1])) return null
  const need = last[2] && last[2] !== '-' ? last[2] : undefined
  return { status: last[1], ...(need ? { need } : {}), note: last[3].trim() }
}

const overlaps = (a, b) => covers(a, b) || covers(b, a)

/** Why a planned/queued task can't start yet, or null when it can. */
export function whyWaiting(task, tasks, { maxWorkers }) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const waitingOn = task.dependsOn.filter((d) => {
    const dep = byId.get(d)
    return !(DONE.includes(dep.status) || (dep.contract && dep.status === 'pr-open'))
  })
  if (waitingOn.length) {
    return `waits for: ${waitingOn.map((d) => byId.get(d).title).join(', ')}`
  }
  const others = tasks.filter((t) => t.id !== task.id)
  for (const other of others.filter((t) => HOLDS_FOLDERS.includes(t.status))) {
    const shared = task.folders.find((f) => other.folders.some((o) => overlaps(f, o)))
    if (shared) return `shares ${shared} with ${other.title}`
  }
  const running = others.filter((t) => RUNNING.includes(t.status)).length
  if (running >= maxWorkers) return `worker cap (${maxWorkers}) reached`
  return null
}

/** Ids of tasks that may start now, in board order, without exceeding the cap or overlapping. */
export function runnableTasks(board, config) {
  const tasks = board.tasks.map((t) => ({ ...t }))
  const picked = []
  for (const task of tasks) {
    if (!['planned', 'queued'].includes(task.status)) continue
    if (whyWaiting(task, tasks, config)) continue
    picked.push(task.id)
    task.status = 'drafting' // counts as running for the next pick
  }
  return picked
}

const ICON = {
  planned: '◷',
  queued: '◷',
  drafting: '●',
  coding: '●',
  checking: '●',
  ready: '◆',
  'needs-you': '?',
  'pr-open': '↑',
  merged: '✓',
  finished: '✓',
  blocked: '✗',
}

/** The board as the owner reads it: tasks by feature, readable names, then "Needs you". */
export function renderBoard(board, { maxWorkers, featureTitles = {} }) {
  const { tasks } = board
  const running = tasks.filter((t) => RUNNING.includes(t.status)).length
  const out = [`Board — workers ${running}/${maxWorkers}`]
  for (const feature of [...new Set(tasks.map((t) => t.feature))]) {
    out.push('', `${featureTitles[feature] ?? feature} (${feature})`)
    for (const t of tasks.filter((x) => x.feature === feature)) {
      const waiting = ['planned', 'queued'].includes(t.status)
        ? whyWaiting(t, tasks, { maxWorkers })
        : null
      const status = t.status === 'needs-you' ? 'NEEDS YOU' : t.status
      const detail = [t.pr ? `PR #${t.pr}` : null, waiting ?? t.note].filter(Boolean).join(' — ')
      out.push(`  ${ICON[t.status]} ${`${t.title} `.padEnd(28, '.')} ${status.padEnd(9)} ${detail}`)
    }
  }
  const needs = tasks.filter((t) => t.status === 'needs-you')
  out.push('', needs.length ? 'Needs you' : 'Needs you — nothing')
  needs.forEach((t, i) => {
    const what = t.need === 'gate1' ? 'approve tasks.md?' : (t.need ?? 'answer')
    out.push(`  ${i + 1}. ${t.title} — ${what} ${t.note ?? ''}`.trimEnd())
  })
  return out.join('\n')
}

// ── Team setup (Gate 2 enforcement) ───────────────────────────────────────────────────────
// GitHub never lets a PR's author approve it, so "reviewed by the other developer" holds
// once the default branch REQUIRES an approving code-owner review on the latest push.
// checkTeamSetup says whether it does; team.mjs gathers the facts with read-only gh calls.

export const REQUIRED_CHECKS = ['approvals', 'node-22', 'quality', 'size']
export const CODEOWNER_PLACEHOLDER = '@teammate-github-username'

/**
 * CODEOWNERS rules, one per line: `{ pattern, owners }`. Owners are `@user`, `@org/team` or
 * an email. GitHub uses only the LAST matching line for a file, so each line must stand on
 * its own.
 */
export function parseCodeowners(text) {
  return String(text)
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const [pattern, ...rest] = line.split(/\s+/)
      return { pattern, owners: rest.filter((o) => o.includes('@')) }
    })
}

/** Every rule the harness relies on, each `{ rule, ok, fix }`. */
export function checkTeamSetup({ branch, protection, collaborators, codeowners }) {
  const p = protection ?? {}
  const reviews = p.required_pull_request_reviews ?? {}
  const checks = new Set([
    ...(p.required_status_checks?.contexts ?? []),
    ...(p.required_status_checks?.checks ?? []).map((c) => c.context),
  ])
  const missingChecks = REQUIRED_CHECKS.filter((c) => !checks.has(c))
  // A team or an email counts as one owner; a line needs two, or its author has no reviewer.
  const thin = codeowners.filter(
    (l) => l.owners.filter((o) => o !== CODEOWNER_PLACEHOLDER).length < 2,
  )
  const writers = new Set(collaborators.map((c) => c.toLowerCase()))
  const users = [...new Set(codeowners.flatMap((l) => l.owners).filter((o) => /^@[^/]+$/.test(o)))]
  const strangers = users.filter((o) => !writers.has(o.slice(1).toLowerCase()))
  const setting = (what) => `in Settings → Branches → ${branch}: ${what}`
  return [
    {
      rule: `${branch} is protected`,
      ok: Boolean(protection),
      fix: `add a branch protection rule for ${branch} (TEAM.md → Branch protection has one command)`,
    },
    {
      rule: 'required status checks: approvals, node-22, quality, size',
      ok: Boolean(protection) && missingChecks.length === 0,
      fix: setting(
        `require status checks ${missingChecks.join(', ') || REQUIRED_CHECKS.join(', ')}`,
      ),
    },
    {
      rule: 'at least 1 approving review',
      ok: (reviews.required_approving_review_count ?? 0) >= 1,
      fix: setting('require a pull request with 1 approval'),
    },
    {
      rule: 'review from a code owner',
      ok: Boolean(reviews.require_code_owner_reviews),
      fix: setting('require review from Code Owners'),
    },
    {
      rule: 'new pushes dismiss approvals',
      ok: Boolean(reviews.dismiss_stale_reviews),
      fix: setting('dismiss stale pull request approvals when new commits are pushed'),
    },
    {
      rule: 'the last push needs approval from someone else',
      ok: Boolean(reviews.require_last_push_approval),
      fix: setting('require approval of the most recent reviewable push'),
    },
    {
      rule: 'admins follow the rules too',
      ok: Boolean(p.enforce_admins?.enabled),
      fix: setting('do not allow bypassing the above settings (include administrators)'),
    },
    {
      rule: 'no force pushes or deletion',
      ok: Boolean(protection) && !p.allow_force_pushes?.enabled && !p.allow_deletions?.enabled,
      fix: setting('leave "allow force pushes" and "allow deletions" off'),
    },
    {
      rule: `every CODEOWNERS line on ${branch} names two or more owners`,
      ok: codeowners.length > 0 && thin.length === 0,
      fix: codeowners.length
        ? `give these lines a second owner on ${branch}: ${thin.map((l) => l.pattern).join(', ')}`
        : `add .github/CODEOWNERS with both developers to ${branch} (merge it before protection)`,
    },
    {
      rule: 'every code owner can push (a collaborator with write access)',
      ok: strangers.length === 0,
      fix: `add ${strangers.join(', ')} in Settings → Collaborators with write access`,
    },
  ]
}

/** CODEOWNERS with every rule line owned by every member (comments and patterns kept). */
export function renderCodeowners(text, logins) {
  const owners = logins.map((l) => `@${l}`).join(' ')
  return String(text)
    .split('\n')
    .map((line) => {
      const m = /^(\s*[^\s#]\S*\s+)(?:\S+\s*)*?(#.*)?$/.exec(line)
      if (!m || /^\s*#/.test(line) || !line.trim()) return line
      return `${m[1]}${owners}`
    })
    .join('\n')
}
