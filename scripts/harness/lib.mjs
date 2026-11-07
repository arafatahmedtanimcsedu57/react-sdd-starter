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

const email = z.string().regex(/^[^@\s]+@[^@\s]+$/, 'owner must be a git email (user@host)')

// Definitions only. State, attempts and evidence live in features.ledger.jsonl, which merges
// by union — so two developers' branches never conflict over a feature's state.
const featureSchema = z.object({
  id: z.string().regex(/^F\d{2,}$/, 'id must look like F01'),
  title: z.string().min(1),
  owner: email,
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
  if (current.owner !== me) {
    throw new Error(
      `${id} belongs to ${current.owner}; you are ${me || 'unknown'}. Only its owner moves it — ` +
        `hand it over first (npm run features -- owner ${id} --set <email>, ask a human).`,
    )
  }
  if (!ALLOWED[current.state]?.includes(to)) {
    throw new Error(`${id}: ${current.state} → ${to} is not allowed.`)
  }
  if (to === 'active') {
    const mine = features.filter((f) => f.owner === me && f.state === 'active' && f.id !== id)
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

/** Definitions in features.json that the ledger doesn't back up (edited by hand). */
export function findLedgerDrift(list, ledger) {
  const defs = replayDefinitions(ledger)
  const known = new Set(ledger.filter((e) => e.to === 'not_started').map((e) => e.id))
  return list.features.flatMap((f) => {
    if (!known.has(f.id)) return [`${f.id} is not in the ledger (added by hand?)`]
    const problems = []
    const recorded = defs[f.id] ?? {}
    if (recorded.scope && !sameScope(recorded.scope, f.scope)) {
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
 * Which features this branch works on: those named by the changes it touched, else the
 * caller's own active features. Two developers can each have features active; the scope
 * check must use the one this branch builds, not whichever comes first.
 */
export function scopeForBranch({ changeFeatures, features, me }) {
  const named = features.filter((f) => changeFeatures.includes(f.id))
  const picked = named.length
    ? named
    : features.filter((f) => f.state === 'active' && f.owner === me)
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
