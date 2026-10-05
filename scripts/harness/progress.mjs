// Rewrites the generated block at the top of PROGRESS.md from the repo's real state
// (features.json + open OpenSpec changes) and prints it. Run it at clock-in and clock-out.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { renderProgressBlock, replaceAutoBlock, summariseTasks } from './lib.mjs'
import { fail, format, git, path, readList } from './io.mjs'

const PROGRESS = 'PROGRESS.md'
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

const block = renderProgressBlock({
  date: new Date().toISOString().slice(0, 10),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
  features: readList(),
  changes: openChanges(),
})

if (!existsSync(path(PROGRESS))) fail(`${PROGRESS} is missing.`)
try {
  writeFileSync(path(PROGRESS), replaceAutoBlock(readFileSync(path(PROGRESS), 'utf8'), block))
} catch (error) {
  fail(error.message)
}
format(PROGRESS)
console.log(block)
console.log('\nThen read the rest of PROGRESS.md and DECISIONS.md.')
