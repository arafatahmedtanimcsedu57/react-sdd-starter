// The feature list CLI. features.json holds definitions (id, title, owner, proof, scope);
// a feature's state lives only in features.ledger.jsonl, which merges by union, so two
// developers' branches never conflict over it. Only a feature's owner moves it.
//
//   npm run features                       list features
//   npm run features -- add --id F03 --title "…" --verify "npx vitest run …" --scope src/x,src/y [--owner a@b.c]
//   npm run features -- start F03          not_started|blocked → active (max limits.activePerOwner)
//   npm run features -- block F03 --reason "…"
//   npm run features -- verify F03         npm run check + the proof command → passing
//   npm run features -- scope F03 --add src/z     widen a scope (ask a human first)
//   npm run features -- owner F03 --set a@b.c     hand a feature over (ask a human first)
//   npm run features -- check              features.json, ledger and features.md agree
//   npm run features -- migrate [--owner a@b.c]   one-time: v1 list (state inside) → v2
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { addFeature, findLedgerDrift, parseFeatureList, transition } from './lib.mjs'
import { appendLedger, fail, git, me, path, readFeatures, writeList } from './io.mjs'

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
  const drift = findLedgerDrift(list, ledger)
  if (drift.length) {
    fail(
      `features.json was edited by hand:\n  ${drift.join('\n  ')}\n` +
        'Only `npm run features` may change features. Restore the file with `git checkout features.json`.',
    )
  }
}

function caller() {
  return (
    me() ||
    fail(
      'git has no user.email, so the harness cannot tell who you are.\n  FIX: git config user.email you@example.com',
    )
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

function run(cmd) {
  console.log(`\n$ ${cmd}`)
  return spawnSync(cmd, { shell: true, stdio: 'inherit' }).status === 0
}

function verify(state, featureId) {
  const feature = state.features.find((f) => f.id === featureId)
  if (!feature) fail(`${featureId} is not in features.json.`)
  if (feature.state !== 'active') {
    fail(`${featureId} is ${feature.state}. Start it first: npm run features -- start ${featureId}`)
  }
  if (feature.owner !== caller()) {
    fail(`${featureId} belongs to ${feature.owner}; only its owner verifies it.`)
  }
  if (run('npm run check') && run(feature.verify)) {
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

function check({ list, ledger }) {
  assertNoDrift(list, ledger)
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

function setDefinition(state, featureId, change, ledgerLine) {
  if (!state.list.features.some((f) => f.id === featureId))
    fail(`${featureId} is not in features.json.`)
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
  const owner = values.owner ?? caller()
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
    const { id: newId, title, verify: proof, scope, change } = values
    if (!newId || !title || !proof || !scope) fail('add needs --id, --title, --verify and --scope.')
    const owner = values.owner ?? caller()
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
    if (!values.set) fail('owner needs --set <email>.')
    setDefinition(state, id, { owner: values.set }, { event: 'owner', owner: values.set })
    console.log(`✓ ${id} now belongs to ${values.set}`)
    break
  case 'check':
    check(state)
    break
  default:
    fail(
      `Unknown command "${command}". Commands: list, add, start, block, verify, scope, owner, check.`,
    )
}
