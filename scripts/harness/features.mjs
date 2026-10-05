// The feature list CLI. Only this script changes a feature's state; every change is also
// appended to features.ledger.jsonl, so a hand-edited features.json is caught.
//
//   npm run features                       list features
//   npm run features -- add --id F03 --title "…" --verify "npx vitest run …" --scope src/x,src/y
//   npm run features -- start F03          not_started|blocked → active (WIP=1)
//   npm run features -- block F03 --reason "…"
//   npm run features -- verify F03         npm run check + the proof command → passing
//   npm run features -- scope F03 --add src/z   widen a scope (ask a human first)
//   npm run features -- check              features.json, ledger and features.md agree
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import {
  addFeature,
  findLedgerDrift,
  parseFeatureList,
  replayLedger,
  replayScopes,
  transition,
} from './lib.mjs'
import { appendLedger, fail, git, path, readLedger, readList, writeList } from './io.mjs'

const MAX_ATTEMPTS = 3

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    id: { type: 'string' },
    title: { type: 'string' },
    verify: { type: 'string' },
    scope: { type: 'string' },
    change: { type: 'string' },
    reason: { type: 'string' },
    add: { type: 'string' },
  },
})
const [command = 'list', id] = positionals

function assertNoDrift(list) {
  const ledger = readLedger()
  const drift = findLedgerDrift(list, replayLedger(ledger), replayScopes(ledger))
  if (drift.length) {
    fail(
      `features.json was edited by hand:\n  ${drift.join('\n  ')}\n` +
        'Only `npm run features` may change features. Restore the file with `git checkout features.json`.',
    )
  }
}

function move(list, featureId, to, opts) {
  const from = list.features.find((f) => f.id === featureId)?.state
  let next
  try {
    next = transition(list, featureId, to, opts)
  } catch (error) {
    return fail(error.message)
  }
  writeList(next)
  appendLedger({ id: featureId, from, to })
  return next
}

function run(cmd) {
  console.log(`\n$ ${cmd}`)
  return spawnSync(cmd, { shell: true, stdio: 'inherit' }).status === 0
}

function verify(list, featureId) {
  const feature = list.features.find((f) => f.id === featureId)
  if (!feature) fail(`${featureId} is not in features.json.`)
  if (feature.state !== 'active') {
    fail(`${featureId} is ${feature.state}. Start it first: npm run features -- start ${featureId}`)
  }
  if (run('npm run check') && run(feature.verify)) {
    const dirty = git('status', '--porcelain') ? '+uncommitted' : ''
    const evidence = {
      commit: `${git('rev-parse', '--short', 'HEAD')}${dirty}`,
      at: new Date().toISOString(),
    }
    move(list, featureId, 'passing', { evidence })
    console.log(`✓ ${featureId} is passing`)
    return
  }
  const attempts = feature.attempts + 1
  writeList({
    ...list,
    features: list.features.map((f) => (f.id === featureId ? { ...f, attempts } : f)),
  })
  const hint =
    attempts >= MAX_ATTEMPTS
      ? `${attempts} failed attempts. Stop and explain to a human (CLAUDE.md → Human in the loop), or block it.`
      : 'Fix the first failure above, then run verify again. Never weaken a test or rule to get green.'
  fail(`${featureId} did not pass (attempt ${attempts}/${MAX_ATTEMPTS}). ${hint}`)
}

function check(list) {
  assertNoDrift(list)
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

function print(list) {
  for (const f of list.features) {
    const extra = f.state === 'blocked' ? `  (${f.blockedReason})` : ''
    console.log(`${f.id}  ${f.state.padEnd(11)} ${f.title}${extra}`)
  }
}

const list = readList()
if (command !== 'check') assertNoDrift(list) // check reports drift itself

switch (command) {
  case 'list':
    print(list)
    break
  case 'add': {
    const { id: newId, title, verify: proof, scope, change } = values
    if (!newId || !title || !proof || !scope) fail('add needs --id, --title, --verify and --scope.')
    let next
    try {
      next = addFeature(list, {
        id: newId,
        title,
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
    })
    console.log(`✓ added ${newId}. Add "**ID:** ${newId}" to its entry in features.md.`)
    break
  }
  case 'start':
    move(list, id, 'active')
    console.log(
      `✓ ${id} is active. Its scope: ${list.features.find((f) => f.id === id).scope.join(', ')}`,
    )
    break
  case 'block':
    move(list, id, 'blocked', { reason: values.reason })
    console.log(`✓ ${id} is blocked`)
    break
  case 'verify':
    verify(list, id)
    break
  case 'scope': {
    if (!values.add) fail('scope needs --add <folder-or-file>.')
    const next = {
      ...list,
      features: list.features.map((f) =>
        f.id === id ? { ...f, scope: [...f.scope, values.add] } : f,
      ),
    }
    if (!list.features.some((f) => f.id === id)) fail(`${id} is not in features.json.`)
    writeList(parseFeatureList(next))
    appendLedger({
      id,
      from: null,
      to: null,
      scope: [...list.features.find((f) => f.id === id).scope, values.add],
    })
    console.log(`✓ ${id} scope now includes ${values.add}`)
    break
  }
  case 'check':
    check(list)
    break
  default:
    fail(`Unknown command "${command}". Commands: list, add, start, block, verify, scope, check.`)
}
