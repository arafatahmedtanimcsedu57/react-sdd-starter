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

const featureSchema = z.object({
  id: z.string().regex(/^F\d{2,}$/, 'id must look like F01'),
  title: z.string().min(1),
  verify: proofCommand,
  scope: z.array(z.string().min(1)).min(1, 'scope needs at least one folder or file'),
  state: z.enum(STATES),
  attempts: z.number().int().min(0).default(0),
  change: z.string().optional(),
  blockedReason: z.string().optional(),
  evidence: z.object({ commit: z.string(), at: z.string() }).optional(),
})

const listSchema = z.object({ version: z.literal(1), features: z.array(featureSchema) })

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
  const feature = { ...input, state: 'not_started', attempts: 0 }
  delete feature.evidence
  delete feature.blockedReason
  return parseFeatureList({ ...list, features: [...list.features, feature] })
}

const ALLOWED = {
  not_started: ['active'],
  active: ['blocked', 'passing'],
  blocked: ['active'],
  passing: [],
}

export function transition(list, id, to, { reason, evidence } = {}) {
  const current = list.features.find((f) => f.id === id)
  if (!current) throw new Error(`${id} is not in features.json.`)
  if (!ALLOWED[current.state].includes(to)) {
    throw new Error(`${id}: ${current.state} → ${to} is not allowed.`)
  }
  if (to === 'active') {
    const other = list.features.find((f) => f.state === 'active' && f.id !== id)
    if (other) {
      throw new Error(
        `${other.id} is still active. WIP=1: finish it (npm run features -- verify ${other.id}) ` +
          `or block it (npm run features -- block ${other.id} --reason "…").`,
      )
    }
  }
  if (to === 'blocked' && !reason) throw new Error(`Blocking ${id} needs a --reason.`)
  if (to === 'passing' && !evidence) {
    throw new Error(`${id} can only become passing with evidence from a verify run.`)
  }

  const updated = { ...current, state: to }
  delete updated.blockedReason
  if (to === 'blocked') updated.blockedReason = reason
  if (to === 'passing') updated.evidence = evidence
  return { ...list, features: list.features.map((f) => (f.id === id ? updated : f)) }
}

export function replayLedger(entries) {
  return entries
    .filter((e) => e.to) // e.g. a scope change, which moves no state
    .reduce((states, e) => ({ ...states, [e.id]: e.to }), {})
}

/** The last scope the ledger recorded per feature (entries that carry a `scope`). */
export function replayScopes(entries) {
  return entries
    .filter((e) => Array.isArray(e.scope))
    .reduce((scopes, e) => ({ ...scopes, [e.id]: e.scope }), {})
}

const sameScope = (a, b) => [...a].sort().join('\n') === [...b].sort().join('\n')

export function findLedgerDrift(list, ledgerStates, ledgerScopes = {}) {
  return list.features.flatMap((f) => {
    if (!(f.id in ledgerStates)) return [`${f.id} is not in the ledger (added by hand?)`]
    const problems = []
    if (ledgerStates[f.id] !== f.state) {
      problems.push(`${f.id} state is "${f.state}" but the ledger says "${ledgerStates[f.id]}"`)
    }
    const recorded = ledgerScopes[f.id]
    if (recorded && !sameScope(recorded, f.scope)) {
      problems.push(
        `${f.id} scope is [${f.scope.join(', ')}] but the ledger says [${recorded.join(', ')}]`,
      )
    }
    return problems
  })
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

function nextStep(features) {
  const active = features.find((f) => f.state === 'active')
  if (active) return `finish ${active.id} — proof: \`${active.verify}\``
  const next = features.find((f) => f.state === 'not_started')
  if (next) return `start ${next.id} — ${next.title} (npm run features -- start ${next.id})`
  if (features.some((f) => f.state === 'blocked')) return 'unblock a blocked feature (ask a human)'
  return 'every feature is passing — add the next one to features.md'
}

export function renderProgressBlock({ date, branch, features: list, changes }) {
  const { features } = list
  const count = (s) => features.filter((f) => f.state === s).length
  const label = (f) => `${f.id} — ${f.title}`
  const active = features.filter((f) => f.state === 'active').map(label)
  const blocked = features
    .filter((f) => f.state === 'blocked')
    .map((f) => `${label(f)} (${f.blockedReason})`)
  const openChanges = changes.map(
    (c) =>
      `${c.name} — ${c.done}/${c.total} tasks, ${c.approved ? `approved by ${c.approved}` : 'approval pending'}`,
  )

  return [
    `_Generated by \`npm run progress\` on ${date}. Do not edit between the markers._`,
    '',
    `- **Branch:** ${branch}`,
    `- **Features:** ${count('passing')} passing · ${count('active')} active · ${count('blocked')} blocked · ${count('not_started')} not started`,
    `- **Active:** ${active.join(', ') || 'none'}`,
    `- **Blocked:** ${blocked.join('; ') || 'none'}`,
    `- **Open OpenSpec changes:** ${openChanges.join('; ') || 'none'}`,
    `- **Next step:** ${nextStep(features)}`,
  ].join('\n')
}

const START = '<!-- harness:auto:start -->'
const END = '<!-- harness:auto:end -->'

export function replaceAutoBlock(doc, block) {
  const from = doc.indexOf(START)
  const to = doc.indexOf(END)
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`PROGRESS.md needs the ${START} … ${END} markers.`)
  }
  return `${doc.slice(0, from + START.length)}\n${block}\n${doc.slice(to)}`
}

/**
 * True when PROGRESS.md's generated block says what `block` says. The "Generated on <date>"
 * line and line wrapping (prettier) don't count — only the facts.
 */
export function autoBlockMatches(doc, block) {
  const from = doc.indexOf(START)
  const to = doc.indexOf(END)
  if (from === -1 || to === -1 || to < from) return false
  const facts = (text) =>
    text
      .replace(/^_Generated by .*_$/m, '')
      .replace(/\s+/g, ' ')
      .trim()
  return facts(doc.slice(from + START.length, to)) === facts(block)
}

// Untracked files a session typically leaves behind. `clock-out --fix` deletes only these.
const JUNK = [/\.log$/, /(^|\/)debug-[^/]*$/, /\.(orig|rej|tmp|bak)$/, /(^|\/)\.DS_Store$/, /~$/]
export const findJunk = (untracked) => untracked.filter((f) => JUNK.some((re) => re.test(f)))

/** One aligned line per trace entry: time, source/step, ok or ✗<exit>, duration, detail. */
export function formatTrace(entries) {
  const width = Math.max(0, ...entries.map((e) => `${e.source}/${e.step}`.length))
  return entries.map((e) => {
    const name = `${e.source}/${e.step}`.padEnd(width)
    const status = (e.exit === 0 ? 'ok' : `✗${e.exit}`).padEnd(4)
    const ms = e.ms === undefined ? '' : `${e.ms}ms`.padStart(8)
    return `${e.at.slice(11, 19)}  ${name}  ${status}${ms}${e.detail ? `  ${e.detail}` : ''}`
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
