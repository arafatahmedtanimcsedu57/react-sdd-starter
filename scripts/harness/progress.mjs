// Prints the team summary (features by owner + open OpenSpec changes) from the repo's real
// state. Run it at clock-in and clock-out. It no longer writes into PROGRESS.md: a generated
// block there was rewritten by every developer's clock-out and always conflicted.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { findLedgerDrift, renderProgress, summariseTasks } from './lib.mjs'
import { fail, path, readFeatures } from './io.mjs'

const CHANGES = 'openspec/changes'

function openChanges() {
  if (!existsSync(path(CHANGES))) return []
  return readdirSync(path(CHANGES), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'archive')
    .filter((d) => existsSync(path(`${CHANGES}/${d.name}/tasks.md`)))
    .map((d) => ({
      name: d.name,
      ...summariseTasks(readFileSync(path(`${CHANGES}/${d.name}/tasks.md`), 'utf8')),
    }))
}

const { list, ledger, features } = readFeatures()
const drift = findLedgerDrift(list, ledger)
if (drift.length) fail(`features.json and its ledger disagree:\n  ${drift.join('\n  ')}`)
console.log(renderProgress({ features, changes: openChanges() }))
console.log('\nThen read your section of PROGRESS.md, and DECISIONS.md.')
