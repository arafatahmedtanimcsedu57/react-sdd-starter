// Fails when this branch changes files outside the active feature's scope (WIP=1 also
// means "one area at a time"). Runs in the Stop hook; `npm run scope` runs it by hand.
import { findLedgerDrift, findOutOfScope, replayLedger, replayScopes } from './lib.mjs'
import { ALWAYS_IN_SCOPE, changedFiles, fail, readLedger, readList } from './io.mjs'

const list = readList()
// A hand-edited list (e.g. a widened scope) must not steer the check.
const ledger = readLedger()
const drift = findLedgerDrift(list, replayLedger(ledger), replayScopes(ledger))
if (drift.length) fail(`features.json was edited by hand:\n  ${drift.join('\n  ')}`)

const active = list.features.find((f) => f.state === 'active')
if (!active) {
  console.log('scope: no active feature, nothing to check')
  process.exit(0)
}

const outside = findOutOfScope(changedFiles(), active.scope, ALWAYS_IN_SCOPE)
if (outside.length === 0) {
  console.log(`✓ scope: every change is inside ${active.id} (${active.scope.join(', ')})`)
  process.exit(0)
}

console.error(
  `✗ ${active.id} is active, but these changes are outside its scope (${active.scope.join(', ')}):\n` +
    outside.map((f) => `  ${f}`).join('\n') +
    '\nFIX: undo them, or make them their own feature. If they truly belong to ' +
    `${active.id}, ask the human, then: npm run features -- scope ${active.id} --add <folder>`,
)
process.exit(1)
