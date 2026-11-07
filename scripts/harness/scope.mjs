// Fails when this branch changes files outside the scope of the feature it builds. That is
// the feature named by the OpenSpec change(s) this branch touched ("Feature: F03" in
// proposal.md), else the developer's own active features — with two developers, several
// features are active at once. Runs in the Stop hook; `npm run scope` runs it by hand.
import { existsSync, readFileSync } from 'node:fs'
import {
  changesTouched,
  findLedgerDrift,
  findOutOfScope,
  resolveChangeFeatures,
  scopeForBranch,
} from './lib.mjs'
import { ALWAYS_IN_SCOPE, changedFiles, fail, path, readFeatures, whoami } from './io.mjs'

const { list, ledger, team, features } = readFeatures()
// A hand-edited list (e.g. a widened scope) must not steer the check.
const drift = findLedgerDrift(list, ledger, team)
if (drift.length) fail(`features.json was edited by hand:\n  ${drift.join('\n  ')}`)

const files = changedFiles()
const proposals = changesTouched(files).map((name) => {
  const file = path(`openspec/changes/${name}/proposal.md`)
  return { name, text: existsSync(file) ? readFileSync(file, 'utf8') : null }
})
const { named, problems, notes } = resolveChangeFeatures(proposals, features)
if (problems.length) {
  fail(
    `${problems.join('\n✗ ')}\nFIX: correct the "Feature:" line in that proposal.md, or add the ` +
      'feature first (npm run features -- add …).',
  )
}

const target = scopeForBranch({ changeFeatures: named, features, me: whoami(team) })
if (!target) {
  const why = notes.length ? `; ${notes.join('; ')}` : ''
  console.log(`scope: no feature for this branch (no change names one, none of yours active)${why}`)
  process.exit(0)
}

const ids = target.ids.join(', ')
const outside = findOutOfScope(files, target.scope, ALWAYS_IN_SCOPE)
if (outside.length === 0) {
  console.log(`✓ scope: every change is inside ${ids} (${target.scope.join(', ')})`)
  process.exit(0)
}

console.error(
  `✗ ${ids} ${target.ids.length > 1 ? 'are' : 'is'} active, but these changes are outside ` +
    `its scope (${target.scope.join(', ')}):\n` +
    outside.map((f) => `  ${f}`).join('\n') +
    '\nFIX: undo them, or make them their own feature. If they truly belong here, ask the ' +
    `human, then: npm run features -- scope ${target.ids[0]} --add <folder>`,
)
process.exit(1)
