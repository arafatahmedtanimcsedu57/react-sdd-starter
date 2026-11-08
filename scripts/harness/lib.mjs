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
  // A readable copy of who may hand over anyone's unfinished feature. The ledger is the
  // record (`npm run team -- lead`); when present, this must match it.
  leads: z.array(z.string().regex(LOGIN, 'leads must be GitHub usernames (no @)')).optional(),
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
  const logins = new Set(result.data.members.map((m) => m.github.toLowerCase()))
  const stranger = result.data.leads?.find((l) => !logins.has(l.toLowerCase()))
  if (stranger) throw new Error(`team.json: lead @${stranger} is not a member`)
  return result.data
}

/**
 * Leads, replayed from the ledger like joins: the first member to join founds the team as
 * its lead; `{ event: 'lead', github, remove? }` lines (written by a lead) add or remove one.
 * `step(e)` applies one line and returns a problem, or null.
 */
export function leadReplay() {
  const leads = new Set()
  let founded = false
  return {
    leads,
    has: (login) => Boolean(login) && leads.has(login.toLowerCase()),
    step(e, byLogin) {
      if (e.event === 'join' && !founded && e.github) {
        founded = true
        leads.add(e.github.toLowerCase())
      }
      if (e.event !== 'lead' || !e.github) return null
      if (!leads.has(byLogin?.toLowerCase())) return `lead changed by ${e.by}, who is not a lead`
      if (e.remove) leads.delete(e.github.toLowerCase())
      else leads.add(e.github.toLowerCase())
      return leads.size ? null : 'removes the last lead'
    },
  }
}

/** The leads now (lowercase logins), from the ledger. */
export function ledgerLeads(ledger) {
  const replay = leadReplay()
  const joined = {}
  for (const e of ledger) {
    if (e.event === 'join' && e.by && e.github) joined[e.by.toLowerCase()] = e.github
    replay.step(e, joined[e.by?.toLowerCase()])
  }
  return [...replay.leads]
}

export const isLead = (leads, me) => {
  const github = asMe(me).github?.toLowerCase()
  return Boolean(github) && leads.some((l) => l.toLowerCase() === github)
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
  if (email && featureOwner.toLowerCase() === email.toLowerCase()) return true
  return Boolean(github) && featureOwner.toLowerCase() === `@${github}`.toLowerCase()
}
const label = (me) => {
  const { email, github } = asMe(me)
  return github ? `@${github}` : email || 'unknown'
}

/** Why `me` may not touch a feature owned by `owner` — with the right next step. */
export function notOwnerMessage(id, owner, me, what = 'moves it') {
  const { email, github } = asMe(me)
  if (owner.startsWith('@') && !github) {
    return (
      `${id} belongs to ${owner}, and ${email || 'your git email'} isn't linked to a GitHub ` +
      'login on this branch. If that is you: run `npm run team -- join` here, or branch from ' +
      'your join branch until its PR merges.'
    )
  }
  return (
    `${id} belongs to ${owner}; you are ${label(me)}. Only its owner ${what} — hand it over ` +
    `first (npm run features -- owner ${id} --set <@login|email>; a lead can, with --reason).`
  )
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

/** The next feature id after every id in `ids` (local and on other branches). */
export function nextId(ids) {
  const max = Math.max(0, ...[...ids].map((id) => Number(/^F(\d+)$/.exec(id)?.[1] ?? 0)))
  return `F${String(max + 1).padStart(2, '0')}`
}

/** Owners with more than `limits.activePerOwner` active — two branches each started one. */
export function overLimit(features, limits, team) {
  const key = (owner) => {
    const login = owner.startsWith('@') ? owner.slice(1) : loginFor(team ?? { members: [] }, owner)
    return (login ? `@${login}` : owner).toLowerCase()
  }
  const active = {}
  for (const f of features.filter((x) => x.state === 'active')) {
    ;(active[key(f.owner)] ??= { owner: f.owner, ids: [] }).ids.push(f.id)
  }
  return Object.values(active).filter((a) => a.ids.length > limits.activePerOwner)
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
  if (!isOwner(current.owner, me)) throw new Error(notOwnerMessage(id, current.owner, me))
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
    if (!e.id) continue
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
export function findLedgerAnomalies(ledger) {
  const problems = []
  // Leads in force when each line was written, so removing a lead later never turns their
  // old hand-overs red, and making someone a lead never blesses their old lines.
  const leads = leadReplay()
  const state = {}
  const owner = {}
  // email → @login, from the `join` lines seen so far: a line is checked against the links
  // in force when it was written, so a member re-joining with a new email stays valid.
  const joined = {}
  let sawBy = false
  ledger.forEach((e, i) => {
    const where = `ledger line ${i + 1} (${e.id ?? e.event})`
    if (e.by) sawBy = true
    else if (sawBy) problems.push(`${where} has no "by" — written by hand?`)
    if (e.event === 'join' && e.by && e.github) joined[e.by.toLowerCase()] = e.github
    const leadProblem = leads.step(e, joined[e.by?.toLowerCase()])
    if (leadProblem) problems.push(`${where}: ${leadProblem}`)
    if (e.event === 'join' || e.event === 'lead') return
    const checked = Boolean(e.by)
    const byOwner = () => isOwner(owner[e.id], { email: e.by, github: joined[e.by.toLowerCase()] })
    const notOwner = (what) =>
      checked && owner[e.id] && !byOwner()
        ? [`${where}: ${what} by ${e.by}, not the owner ${owner[e.id]}`]
        : []

    if (e.event === 'owner') {
      const asLead = checked && owner[e.id] && !byOwner()
      const byLead = e.reason && leads.has(joined[e.by?.toLowerCase()])
      if (!byLead) problems.push(...notOwner('owner changed'))
      // As the CLI: a lead may not take over a shipped feature (its owner may re-label it).
      if (asLead && byLead && state[e.id] === 'passing') {
        problems.push(`${where}: a lead hands over a passing feature`)
      }
      owner[e.id] = e.owner
      return
    }
    if (!e.to) {
      if (Array.isArray(e.scope)) problems.push(...notOwner('scope changed'))
      return
    }
    const from = state[e.id] ?? null
    // The same move made on two branches (e.g. `start` in two worktrees), union-merged: it
    // repeats the state the feature is already in, so it changes nothing.
    if (from !== null && e.to === from && ALLOWED[e.from]?.includes(e.to)) {
      if (checked && e.to === 'passing' && !e.evidence) {
        problems.push(`${where}: passing without evidence from a verify run`)
      }
      problems.push(...notOwner('moved'))
      return
    }
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

/** team.json emails that no `join` line backs: someone typed an email in by hand. */
function rosterDrift(team, ledger) {
  const recorded = (m) =>
    ledger.some(
      (e) =>
        e.event === 'join' &&
        e.github?.toLowerCase() === m.github.toLowerCase() &&
        e.by?.toLowerCase() === m.email.toLowerCase(),
    )
  return (team?.members ?? [])
    .filter((m) => m.email && !recorded(m))
    .map(
      (m) =>
        `team.json links @${m.github} to ${m.email}, but no \`npm run team -- join\` recorded it`,
    )
}

/** team.json `leads` (when present) that differ from the ledger's: a hand edit. */
function leadDrift(team, ledger) {
  if (!team?.leads) return []
  const want = ledgerLeads(ledger).sort().join(', ')
  const have = team.leads
    .map((l) => l.toLowerCase())
    .sort()
    .join(', ')
  return want === have
    ? []
    : [`team.json leads are [${have}] but the ledger says [${want}]: use npm run team -- lead`]
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
    .concat(findLedgerAnomalies(ledger))
    .concat(leadDrift(team, ledger))
    .concat(rosterDrift(team, ledger))
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

// A `## @login` / `## <email>` heading: a per-person section, which now lives in its own
// file (two people adding theirs the same day always conflicted at the end of PROGRESS.md).
const PERSON_HEADING = /^## (@[A-Za-z\d-]+|[^@\s]+@[^@\s]+)\s*$/gm

export function checkProgressDoc(text) {
  const problems = OLD_MARKERS.test(text)
    ? [
        'has the old generated block (harness:auto markers). Remove it; `npm run progress` prints it.',
      ]
    : []
  const people = [...String(text).matchAll(PERSON_HEADING)].map((m) => m[1])
  if (people.length) {
    problems.push(
      `has per-person sections (${people.join(', ')}); each now lives in progress/<id>.md.\n  FIX: npm run progress -- migrate`,
    )
  }
  return problems
}

/** Your handoff file: `progress/<login>.md` once joined, else `progress/<email>.md`. */
export const progressFile = (me) => {
  const { email, github } = asMe(me)
  const id = github || email
  return id ? `progress/${id.toLowerCase()}.md` : null
}

/** A handoff file's text, whitespace-normalised (what clock-out compares). */
export const progressText = (text) => String(text).replace(/\s+/g, ' ').trim()

/**
 * PROGRESS.md split for `npm run progress -- migrate`: the shared part (everything that isn't
 * a per-person section) and each `## @login` / `## <email>` section's name and body.
 */
export function splitProgress(doc) {
  const lines = String(doc).split('\n')
  const shared = []
  const sections = []
  let current = null
  for (const line of lines) {
    const person = /^## (@[A-Za-z\d-]+|[^@\s]+@[^@\s]+)\s*$/.exec(line)
    if (person) {
      current = { name: person[1], body: [] }
      sections.push(current)
    } else if (/^## /.test(line)) {
      current = null
      shared.push(line)
    } else if (current) current.body.push(line)
    else shared.push(line)
  }
  return {
    shared: `${shared.join('\n').trimEnd()}\n`,
    sections: sections.map((s) => ({ name: s.name, body: `${s.body.join('\n').trim()}\n` })),
  }
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
 * Clock-out's handoff rule, or null when it holds. `now` / `before` are the caller's
 * `progress/<id>.md` today and at the fork point (null = no file). Nothing changed → nothing to
 * hand off; on the default branch only the commit check applies.
 */
export function progressProblem({ changed, now, before, onDefault, file }) {
  if (!file) return 'git has no user.email.\nFIX: git config user.email you@example.com'
  if (!changed.length) return null
  if (now === null) {
    return `You have no handoff file.\nFIX: mkdir -p progress && cp progress/_template.md ${file}, then fill in Current work, Known issues, Next step.`
  }
  if (!onDefault && before !== null && before === now) {
    return `This branch changes files but not ${file}.\nFIX: update its Current work, Known issues and Next step.`
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

/**
 * Owned CODEOWNERS lines that miss a roster member (e.g. a bad conflict resolution). A line
 * owned by a GitHub team (`@org/team`) or an email is the team's own choice: skipped.
 */
export function codeownersMissing(text, logins) {
  return parseCodeowners(text)
    .filter((r) => r.owners.length && r.owners.every((o) => /^@[^/@]+$/.test(o)))
    .flatMap((r) => {
      const listed = new Set(r.owners.map((o) => o.toLowerCase()))
      const missing = logins.filter((l) => !listed.has(`@${l}`.toLowerCase()))
      return missing.length ? [`${r.pattern} misses ${missing.map((l) => `@${l}`).join(' ')}`] : []
    })
}

/**
 * CODEOWNERS with every owned rule owned by every member. Comments, patterns (escaped spaces
 * included), inline comments and line endings are kept; a rule with no owners is left
 * unowned on purpose.
 */
export function renderCodeowners(text, logins) {
  const owners = logins.map((l) => `@${l}`).join(' ')
  return String(text)
    .split('\n')
    .map((raw) => {
      const cr = raw.endsWith('\r') ? '\r' : ''
      const line = cr ? raw.slice(0, -1) : raw
      if (!line.trim() || /^\s*#/.test(line)) return raw
      const m = /^(\s*(?:\\\s|\S)+)(\s+)(.*)$/.exec(line)
      if (!m) return raw
      const [, pattern, gap, rest] = m
      const hash = rest.search(/(^|\s)#/)
      const listed = hash === -1 ? rest : rest.slice(0, hash)
      const comment = hash === -1 ? '' : ` ${rest.slice(hash).trim()}`
      return listed.includes('@') ? `${pattern}${gap}${owners}${comment}${cr}` : raw
    })
    .join('\n')
}
