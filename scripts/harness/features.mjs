// The feature list CLI. features.json holds definitions (id, title, owner, proof, scope);
// a feature's state lives only in features.ledger.jsonl, which merges by union, so two
// developers' branches never conflict over it. Only a feature's owner moves it.
//
//   npm run features                       list features
//   npm run features -- add --title "…" --verify "npx vitest run …" --scope src/x,src/y [--owner @login] [--id F03]
//   npm run features -- start F03          not_started|blocked → active (max limits.activePerOwner)
//   npm run features -- block F03 --reason "…"
//   npm run features -- verify F03         npm run check + the proof command → passing
//   npm run features -- scope F03 --add src/z     widen a scope (ask a human first)
//   npm run features -- owner F03 --set @login    hand a feature over (a lead: any unfinished one, with --reason)
//   npm run features -- check              features.json, ledger and features.md agree
//   npm run features -- migrate [--owner a@b.c]   one-time: v1 list (state inside) → v2
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
  addFeature,
  findLedgerDrift,
  isLead,
  isOwner,
  nextId,
  notOwnerMessage,
  overLimit,
  parseFeatureList,
  transition,
} from './lib.mjs'
import {
  appendLedger,
  appendTrace,
  fail,
  git,
  path,
  readFeatures,
  readTeam,
  whoami,
  writeList,
} from './io.mjs'

const MAX_ATTEMPTS = 3

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    title: { type: 'string' },
    verify: { type: 'string' },
    scope: { type: 'string' },
    owner: { type: 'string' },
    change: { type: 'string' },
    reason: { type: 'string' },
    add: { type: 'string' },
    set: { type: 'string' },
  },
})
const [command = 'list', id] = positionals

function assertNoDrift(list, ledger) {
  const drift = findLedgerDrift(list, ledger, readTeam())
  if (drift.length) {
    fail(
      `features.json, team.json and the ledger disagree (a hand edit?):\n  ${drift.join('\n  ')}\n` +
        'Only `npm run features` / `npm run team` may change them. Restore a hand-edited file with ' +
        '`git checkout <file>`; a team.json email nobody recorded → that member runs `npm run team -- join`.',
    )
  }
}

// The caller as { email, github? }; the email is required (ledger lines record it).
// An @login owner must be on the roster, or the feature is orphaned: nobody can move it.
function knownOwner(owner) {
  if (!owner.startsWith('@')) return owner
  const login = owner.slice(1).toLowerCase()
  return readTeam().members.some((m) => m.github.toLowerCase() === login)
    ? owner
    : fail(`${owner} is not on the team (team.json).\n  FIX: npm run team -- add ${owner}`)
}

function caller() {
  const who = whoami()
  return who.email
    ? who
    : fail(
        'git has no user.email, so the harness cannot tell who you are.\n  FIX: git config user.email you@example.com',
      )
}

function move(state, featureId, to, opts = {}) {
  let line
  try {
    line = transition(state.features, featureId, to, {
      me: caller(),
      limits: state.list.limits,
      ...opts,
    })
  } catch (error) {
    return fail(error.message)
  }
  appendLedger(line)
}

function run(cmd, featureId) {
  console.log(`\n$ ${cmd}`)
  const started = Date.now()
  const exit = spawnSync(cmd, { shell: true, stdio: 'inherit' }).status ?? 1
  appendTrace({
    source: 'features',
    step: `verify ${featureId}`,
    exit,
    ms: Date.now() - started,
    detail: cmd,
  })
  return exit === 0
}

function verify(state, featureId) {
  const feature = state.features.find((f) => f.id === featureId)
  if (!feature) fail(`${featureId} is not in features.json.`)
  if (feature.state !== 'active') {
    fail(`${featureId} is ${feature.state}. Start it first: npm run features -- start ${featureId}`)
  }
  if (!isOwner(feature.owner, caller())) {
    fail(`${featureId} belongs to ${feature.owner}; only its owner verifies it.`)
  }
  if (run('npm run check', featureId) && run(feature.verify, featureId)) {
    const dirty = git('status', '--porcelain') ? '+uncommitted' : ''
    const evidence = {
      commit: `${git('rev-parse', '--short', 'HEAD')}${dirty}`,
      at: new Date().toISOString(),
    }
    move(state, featureId, 'passing', { evidence })
    console.log(`✓ ${featureId} is passing`)
    return
  }
  appendLedger({ id: featureId, event: 'verify_failed' })
  const attempts = feature.attempts + 1
  const hint =
    attempts >= MAX_ATTEMPTS
      ? `${attempts} failed attempts. Stop and explain to a human (CLAUDE.md → Human in the loop), or block it.`
      : 'Fix the first failure above, then run verify again. Never weaken a test or rule to get green.'
  fail(`${featureId} did not pass (attempt ${attempts}/${MAX_ATTEMPTS}). ${hint}`)
}

// Ids on master and every pushed branch, so two people adding a feature the same day don't
// both take the next one (and then "keep both" in the conflict). Offline → cached refs.
function idsElsewhere() {
  git('fetch', '--quiet')
  const where = new Map()
  for (const ref of git('for-each-ref', '--format=%(refname:short)', 'refs/remotes').split('\n')) {
    if (!ref || ref.endsWith('/HEAD')) continue
    try {
      for (const f of JSON.parse(git('show', `${ref}:features.json`) || '{}').features ?? []) {
        if (!where.has(f.id)) where.set(f.id, ref)
      }
    } catch {
      // not a v2 list on that branch: nothing to reserve
    }
  }
  return where
}

function check({ list, ledger, features, team }) {
  assertNoDrift(list, ledger)
  // A warning, not a failure: failing master would block everyone for one owner's overlap.
  for (const o of overLimit(features, list.limits, team)) {
    console.warn(
      `⚠ ${o.owner} has ${o.ids.length} active (${o.ids.join(', ')}); the limit is ` +
        `${list.limits.activePerOwner}. Block one: npm run features -- block <id> --reason "…"`,
    )
  }
  const prose = readFileSync(path('features.md'), 'utf8')
  const proseIds = new Set([...prose.matchAll(/\*\*ID:\*\*\s*(F\d+)/g)].map((m) => m[1]))
  const jsonIds = new Set(list.features.map((f) => f.id))
  const onlyProse = [...proseIds].filter((x) => !jsonIds.has(x))
  const onlyJson = [...jsonIds].filter((x) => !proseIds.has(x))
  if (onlyProse.length || onlyJson.length) {
    fail(
      'features.md and features.json disagree.\n' +
        (onlyProse.length
          ? `  In features.md only: ${onlyProse.join(', ')} → npm run features -- add …\n`
          : '') +
        (onlyJson.length
          ? `  In features.json only: ${onlyJson.join(', ')} → add a "**ID:**" line to its features.md entry\n`
          : ''),
    )
  }
  console.log(`✓ features: ${list.features.length} features, ledger and features.md agree`)
}

function print(features) {
  for (const f of features) {
    const extra = f.state === 'blocked' ? `  (${f.blockedReason})` : ''
    console.log(`${f.id}  ${f.state.padEnd(11)} ${f.title}  [${f.owner}]${extra}`)
  }
}

// Widening a scope or handing a feature over is the owner's call (after asking a human);
// otherwise anyone could take a feature and then move it.
function setDefinition(state, featureId, change, ledgerLine, { leadMay = false } = {}) {
  const current = state.list.features.find((f) => f.id === featureId)
  if (!current) fail(`${featureId} is not in features.json.`)
  const me = caller()
  if (!isOwner(current.owner, me)) {
    const lead = leadMay && isLead(readTeam(), me)
    if (!lead) fail(notOwnerMessage(featureId, current.owner, me, 'changes its scope or owner'))
    if (!values.reason) fail(`A lead handing over ${featureId} must say why: --reason "…"`)
    if (state.features.find((f) => f.id === featureId).state === 'passing') {
      fail(`${featureId} is passing (shipped); its history stays with ${current.owner}.`)
    }
  }
  let next
  try {
    next = parseFeatureList({
      ...state.list,
      features: state.list.features.map((f) => (f.id === featureId ? { ...f, ...change } : f)),
    })
  } catch (error) {
    fail(error.message)
  }
  writeList(next)
  appendLedger({ id: featureId, ...ledgerLine })
}

// One-time move from v1 (state stored in features.json) to v2 (definitions + owner; state
// only in the ledger). Every existing feature gets one owner; the ledger records it.
function migrate() {
  const raw = JSON.parse(readFileSync(path('features.json'), 'utf8'))
  if (raw.version !== 1) fail(`features.json is already version ${raw.version}.`)
  const owner = knownOwner(values.owner ?? caller().email)
  let next
  try {
    next = parseFeatureList({
      version: 2,
      limits: { activePerOwner: 2 },
      features: raw.features.map(({ id: fid, title, verify: proof, scope, change }) => ({
        id: fid,
        title,
        owner,
        verify: proof,
        scope,
        ...(change ? { change } : {}),
      })),
    })
  } catch (error) {
    fail(error.message)
  }
  writeList(next)
  for (const f of next.features) appendLedger({ id: f.id, event: 'owner', owner })
  console.log(`✓ features.json is version 2; ${next.features.length} features owned by ${owner}`)
  process.exit(0)
}
if (command === 'migrate') migrate()

const state = readFeatures()
if (command !== 'check') assertNoDrift(state.list, state.ledger) // check reports drift itself

switch (command) {
  case 'list':
    print(state.features)
    break
  case 'add': {
    const { title, verify: proof, scope, change } = values
    if (!title || !proof || !scope) fail('add needs --title, --verify and --scope.')
    const elsewhere = idsElsewhere()
    if (
      values.id &&
      elsewhere.has(values.id) &&
      !state.list.features.some((f) => f.id === values.id)
    )
      fail(
        `${values.id} is already taken on ${elsewhere.get(values.id)}. Leave out --id to get the next free one.`,
      )
    const newId =
      values.id ?? nextId([...state.list.features.map((f) => f.id), ...elsewhere.keys()])
    const owner = knownOwner(values.owner ?? caller().email)
    let next
    try {
      next = addFeature(state.list, {
        id: newId,
        title,
        owner,
        verify: proof,
        scope: scope.split(',').map((s) => s.trim()),
        ...(change ? { change } : {}),
      })
    } catch (error) {
      fail(error.message)
    }
    writeList(next)
    appendLedger({
      id: newId,
      from: null,
      to: 'not_started',
      scope: next.features.at(-1).scope,
      owner,
    })
    console.log(
      `✓ added ${newId} (owner ${owner}). Add "**ID:** ${newId}" to its entry in features.md.`,
    )
    break
  }
  case 'start':
    move(state, id, 'active')
    console.log(
      `✓ ${id} is active. Its scope: ${state.list.features.find((f) => f.id === id).scope.join(', ')}`,
    )
    break
  case 'block':
    move(state, id, 'blocked', { reason: values.reason })
    console.log(`✓ ${id} is blocked`)
    break
  case 'verify':
    verify(state, id)
    break
  case 'scope': {
    if (!values.add) fail('scope needs --add <folder-or-file>.')
    const scope = [...(state.list.features.find((f) => f.id === id)?.scope ?? []), values.add]
    setDefinition(state, id, { scope }, { from: null, to: null, scope })
    console.log(`✓ ${id} scope now includes ${values.add}`)
    break
  }
  case 'owner':
    if (!values.set) fail('owner needs --set <@login|email>.')
    knownOwner(values.set)
    setDefinition(
      state,
      id,
      { owner: values.set },
      { event: 'owner', owner: values.set, ...(values.reason ? { reason: values.reason } : {}) },
      { leadMay: true },
    )
    console.log(`✓ ${id} now belongs to ${values.set}`)
    break
  case 'check':
    check(state)
    break
  default:
    fail(
      `Unknown command "${command}". Commands: list, add, start, block, verify, scope, owner, check, migrate (one-time).`,
    )
}
