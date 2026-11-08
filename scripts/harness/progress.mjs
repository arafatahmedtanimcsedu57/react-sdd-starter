// Prints the team summary (features by owner + open OpenSpec changes) from the repo's real
// state. Run it at clock-in and clock-out. It no longer writes into PROGRESS.md: a generated
// block there was rewritten by every developer's clock-out and always conflicted.
//   npm run progress              features by owner, open changes, everyone's handoff file
//   npm run progress -- migrate   one-time: move `## <name>` sections of PROGRESS.md into
//                                 progress/<id>.md (one file per person: no conflicts)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  findLedgerDrift,
  loginFor,
  overLimit,
  progressFile,
  renderProgress,
  splitProgress,
  summariseTasks,
} from './lib.mjs'
import { fail, path, PROGRESS, readFeatures, readTeam, whoami } from './io.mjs'

if (process.argv.includes('migrate')) {
  const team = readTeam()
  const { shared, sections } = splitProgress(readFileSync(path(PROGRESS), 'utf8'))
  if (!sections.length) {
    console.log(`✓ ${PROGRESS} has no per-person sections; nothing to move.`)
    process.exit(0)
  }
  mkdirSync(path('progress'), { recursive: true })
  for (const { name, body } of sections) {
    // An email heading moves to the login file when that person has joined.
    const github = name.startsWith('@') ? name.slice(1) : loginFor(team, name)
    const file = progressFile({ email: name, github })
    if (existsSync(path(file)))
      fail(`${file} already exists; merge ${name}'s section into it by hand.`)
    // Section headings were ### inside PROGRESS.md; a file of its own uses ##.
    const title = github ? `@${github}` : name
    writeFileSync(path(file), `# Progress — ${title}\n\n${body.replace(/^### /gm, '## ')}`)
    console.log(`✓ ${name} → ${file}`)
  }
  writeFileSync(path(PROGRESS), shared)
  console.log(`✓ ${PROGRESS} keeps the shared part. Commit both in one PR.`)
  process.exit(0)
}

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

const { list, ledger, team, features } = readFeatures()
const drift = findLedgerDrift(list, ledger, team)
if (drift.length) fail(`features.json and its ledger disagree:\n  ${drift.join('\n  ')}`)
console.log(renderProgress({ features, changes: openChanges() }))
for (const o of overLimit(features, list.limits, team)) {
  console.log(
    `⚠ ${o.owner} has ${o.ids.length} active (${o.ids.join(', ')}), over the limit of ${list.limits.activePerOwner}: block one.`,
  )
}
const files = existsSync(path('progress'))
  ? readdirSync(path('progress')).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  : []
if (files.length)
  console.log(`\nHandoff files: ${files.map((f) => f.replace(/\.md$/, '')).join(', ')}`)
const mine = progressFile(whoami(team))
console.log(
  `\nThen read ${mine && existsSync(path(mine)) ? mine : `your handoff file (${mine}, from progress/_template.md)`}, the team-wide part of PROGRESS.md, and DECISIONS.md.`,
)
