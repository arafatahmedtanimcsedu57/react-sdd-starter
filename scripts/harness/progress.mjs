// Prints the team summary (features by owner + open OpenSpec changes) from the repo's real
// state. Run it at clock-in and clock-out. It no longer writes into PROGRESS.md: a generated
// block there was rewritten by every developer's clock-out and always conflicted.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { renderProgress, summariseTasks } from './lib.mjs'
import { path, readFeatures } from './io.mjs'

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

console.log(renderProgress({ features: readFeatures().features, changes: openChanges() }))
console.log('\nThen read your section of PROGRESS.md, and DECISIONS.md.')
